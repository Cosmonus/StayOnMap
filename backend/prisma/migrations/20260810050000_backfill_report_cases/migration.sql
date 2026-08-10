-- Give every existing PropertyReport a SupportCase.
--
-- A DATA migration, and the only destructive thing it does is nothing: no
-- report row is deleted, no report column is modified except `supportCaseId`,
-- which was NULL a moment ago. Run it twice and it does nothing the second
-- time (the WHERE clause excludes reports that already have a case).
--
-- Why backfill at all, when the read paths already fall back for a report with
-- no case: because the admin support inbox is a list of CASES, and a queue that
-- silently omits every report filed before today is worse than no queue. The
-- alternative — teaching every query to union two tables — is the duplication
-- this refactor exists to remove.

-- ── 1. One case per report that has none ───────────────────────────────────
INSERT INTO "SupportCase" (
    "id", "type", "status", "priority", "subject", "description",
    "createdById", "openedAs", "relatedUserId", "relatedPropertyId",
    "resolvedAt", "closedAt", "createdAt", "updatedAt"
)
SELECT
    -- gen_random_uuid() is pgcrypto/PG13+ builtin. Not a cuid, and that is
    -- fine: nothing parses these ids, and the human-facing reference is the
    -- `number` sequence, which fills itself.
    gen_random_uuid()::text,
    -- Category drives the case type, so a fraud report lands in the fraud
    -- queue rather than a generic pile. Everything else is a property report,
    -- which is what it is.
    CASE
        WHEN r."category" IN ('FRAUD', 'BROKER_SPAM') THEN 'FRAUD_REPORT'::"SupportCaseType"
        WHEN r."category" IN ('UNSAFE', 'ILLEGAL', 'HARASSMENT') THEN 'SAFETY_REPORT'::"SupportCaseType"
        ELSE 'PROPERTY_REPORT'::"SupportCaseType"
    END,
    -- The report's own status is the source of truth and is mapped, never
    -- guessed. UNDER_REVIEW becomes IN_PROGRESS because that is what a
    -- moderator opening it means; PENDING stays OPEN.
    CASE r."status"
        WHEN 'PENDING'      THEN 'OPEN'::"SupportCaseStatus"
        WHEN 'UNDER_REVIEW' THEN 'IN_PROGRESS'::"SupportCaseStatus"
        WHEN 'RESOLVED'     THEN 'RESOLVED'::"SupportCaseStatus"
        WHEN 'DISMISSED'    THEN 'CLOSED'::"SupportCaseStatus"
        ELSE 'OPEN'::"SupportCaseStatus"
    END,
    -- Severity is CLIENT-SUPPLIED on a report (see reports.service.js's
    -- auto-suspend rule, which is why it needs two identified reporters), so it
    -- maps to at most HIGH. Nobody gets to mark their own ticket URGENT.
    CASE r."severity"
        WHEN 'CRITICAL' THEN 'HIGH'::"SupportPriority"
        WHEN 'HIGH'     THEN 'HIGH'::"SupportPriority"
        WHEN 'LOW'      THEN 'LOW'::"SupportPriority"
        ELSE 'NORMAL'::"SupportPriority"
    END,
    'Report: ' || replace(r."category"::text, '_', ' '),
    r."description",
    r."reporterId",
    -- Reporting is a renter action even when an owner does it.
    'TENANT'::"SupportAuthorRole",
    p."ownerId",
    r."propertyId",
    CASE WHEN r."status" = 'RESOLVED'  THEN r."createdAt" ELSE NULL END,
    CASE WHEN r."status" = 'DISMISSED' THEN r."createdAt" ELSE NULL END,
    -- The case is as old as the report it describes. Stamping these NOW would
    -- make every historical report look like it arrived today and would put a
    -- fake spike in the first support metrics anyone reads.
    r."createdAt",
    r."createdAt"
FROM "PropertyReport" r
JOIN "Property" p ON p."id" = r."propertyId"
WHERE r."supportCaseId" IS NULL;

-- ── 2. Point each report at its case ───────────────────────────────────────
-- Matched on (property, description, createdAt) rather than a temporary column:
-- the insert above carries all three across verbatim, and adding then dropping
-- a column would make this migration non-reversible for no gain.
UPDATE "PropertyReport" r
SET "supportCaseId" = c."id"
FROM "SupportCase" c
WHERE r."supportCaseId" IS NULL
  AND c."relatedPropertyId" = r."propertyId"
  AND c."description" = r."description"
  AND c."createdAt" = r."createdAt"
  AND NOT EXISTS (SELECT 1 FROM "PropertyReport" x WHERE x."supportCaseId" = c."id");

-- ── 3. Seed the timeline ───────────────────────────────────────────────────
-- Without this a backfilled case opens on an empty activity tab, which reads as
-- "nothing ever happened" rather than "this predates the timeline". The event
-- is stamped with the report's own date and says where it came from.
INSERT INTO "SupportEvent" ("id", "caseId", "type", "actorRole", "actorUserId", "meta", "createdAt")
SELECT
    gen_random_uuid()::text,
    r."supportCaseId",
    'REPORT_SUBMITTED'::"SupportEventType",
    'TENANT'::"SupportAuthorRole",
    r."reporterId",
    jsonb_build_object(
        'reportId', r."id",
        'category', r."category"::text,
        'severity', r."severity"::text,
        'backfilled', true
    ),
    r."createdAt"
FROM "PropertyReport" r
WHERE r."supportCaseId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "SupportEvent" e WHERE e."caseId" = r."supportCaseId");
