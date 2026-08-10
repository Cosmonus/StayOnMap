-- The unified Support & Trust case layer.
--
-- Before this the platform had four unconnected halves: a property report with
-- its own thread, a contact form that emailed and stored nothing at all, a
-- UserReport table with one writer and zero readers, and a "Support" screen
-- that was a list of links. None could be assigned, prioritised, escalated or
-- audited, and none could say how long anything took.
--
-- PropertyReport is NOT replaced and NOT rewritten. It keeps every column it
-- has and gains a nullable link to the case that carries the generic workflow.
-- Existing rows keep working with supportCaseId NULL until the backfill in
-- 20260810050000 runs; the read paths fall back to the report's own `status`,
-- which remains the source of truth for moderation.

-- ── Enums ──────────────────────────────────────────────────────────────────
-- NEW types, so they can be created and used in the same migration. That is
-- only forbidden for values ADDED to an existing enum, which is why the three
-- NotificationType values went into 20260810030000 on their own.
CREATE TYPE "SupportCaseType" AS ENUM (
    'GENERAL_SUPPORT', 'PROPERTY_REPORT', 'LISTING_ISSUE', 'OWNER_VERIFICATION',
    'TENANT_COMPLAINT', 'APPOINTMENT_ISSUE', 'CHAT_ISSUE', 'LEASE_ISSUE',
    'PAYMENT_ISSUE', 'FRAUD_REPORT', 'SAFETY_REPORT', 'TECHNICAL_ISSUE',
    'ACCOUNT_ISSUE', 'OTHER'
);

CREATE TYPE "SupportCaseStatus" AS ENUM (
    'OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_OWNER',
    'ESCALATED', 'RESOLVED', 'CLOSED'
);

CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- SYSTEM exists so a status change can be rendered into the thread without
-- being attributed to a person who did not type it.
CREATE TYPE "SupportAuthorRole" AS ENUM ('TENANT', 'OWNER', 'ADMIN', 'SUPPORT_AGENT', 'SYSTEM');

-- Who may read a message BESIDES staff — staff always see everything, which is
-- what makes moderation possible. Four values, not five: ADMIN_ONLY and
-- INTERNAL would mean the same thing, and two names for one rule is how half
-- the call sites end up using the one nobody enforced.
CREATE TYPE "SupportVisibility" AS ENUM ('PUBLIC', 'TENANT_ONLY', 'OWNER_ONLY', 'INTERNAL');

CREATE TYPE "SupportEventType" AS ENUM (
    'CASE_CREATED', 'CASE_ASSIGNED', 'CASE_REASSIGNED', 'STATUS_CHANGED',
    'PRIORITY_CHANGED', 'MESSAGE_SENT', 'ATTACHMENT_ADDED', 'OWNER_NOTIFIED',
    'REPORT_SUBMITTED', 'OWNER_RESPONDED', 'EVIDENCE_REQUESTED',
    'CASE_ESCALATED', 'LISTING_RESTRICTED', 'CASE_RESOLVED', 'CASE_CLOSED',
    'INTERNAL_NOTE_ADDED'
);

-- ── SupportCase ────────────────────────────────────────────────────────────
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    -- SERIAL, not a formatted string built in application code: "SC-" || count
    -- races under concurrent inserts, and the database already has a sequence
    -- that cannot. Rendered as SC-1042 by features/support/caseRef.js.
    "number" SERIAL NOT NULL,
    "type" "SupportCaseType" NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    -- Nullable: an ANONYMOUS property report has no author and must still
    -- become a case — the moderation queue is exactly where it belongs.
    "createdById" TEXT,
    -- The hat it was opened wearing. Not derivable from User.role: an owner
    -- reporting somebody else's listing is acting as a renter.
    "openedAs" "SupportAuthorRole" NOT NULL DEFAULT 'TENANT',
    "assignedToId" TEXT,
    -- Real foreign keys, one per kind, rather than a polymorphic
    -- (entityType, entityId) pair that cannot be joined, cascaded or
    -- constrained. There is no relatedListing: here a listing IS a Property.
    "relatedUserId" TEXT,
    "relatedPropertyId" TEXT,
    "relatedAppointmentId" TEXT,
    "relatedConversationId" TEXT,
    "relatedLeaseId" TEXT,
    -- The whole SLA data model. Enforcement can be added later without a
    -- migration; these timestamps cannot be recovered after the fact.
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportCase_number_key" ON "SupportCase"("number");
-- The admin queue's default sort and its four headline filters.
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_type_status_idx" ON "SupportCase"("type", "status");
CREATE INDEX "SupportCase_assignedToId_status_idx" ON "SupportCase"("assignedToId", "status");
-- "my requests", the only query a normal user ever runs here.
CREATE INDEX "SupportCase_createdById_createdAt_idx" ON "SupportCase"("createdById", "createdAt");
CREATE INDEX "SupportCase_relatedPropertyId_idx" ON "SupportCase"("relatedPropertyId");

-- ── SupportMessage ─────────────────────────────────────────────────────────
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorRole" "SupportAuthorRole" NOT NULL,
    -- One of these, or neither for SYSTEM. Two nullable columns rather than one
    -- polymorphic author id: staff and users live in different tables behind
    -- different JWT secrets, and a single column would make "which table is
    -- this id in" a question every reader has to answer.
    "authorUserId" TEXT,
    "authorAdminId" TEXT,
    -- DEFAULT INTERNAL — the safest value, not the most convenient. A message
    -- delivered to the wrong party cannot be recalled, so callers opt INTO
    -- wider visibility and a forgotten argument leaks nothing.
    "visibility" "SupportVisibility" NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "readByUserAt" TIMESTAMP(3),
    "readByAdminAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_caseId_createdAt_idx" ON "SupportMessage"("caseId", "createdAt");

-- ── SupportAttachment ──────────────────────────────────────────────────────
CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    -- Nullable: evidence can belong to the case rather than to any one message.
    "messageId" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedByAdminId" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    -- Same default and the same reason as a message, and it matters more here:
    -- a screenshot of a chat can identify the person who sent it.
    "visibility" "SupportVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAttachment_caseId_createdAt_idx" ON "SupportAttachment"("caseId", "createdAt");

-- ── SupportEvent ───────────────────────────────────────────────────────────
-- Append-only by discipline: nothing in backend/src updates or deletes a row
-- here, and the service takes an explicit actor rather than reading one from
-- the request, so an event cannot be attributed by accident.
CREATE TABLE "SupportEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "SupportEventType" NOT NULL,
    "actorRole" "SupportAuthorRole" NOT NULL,
    "actorUserId" TEXT,
    "actorAdminId" TEXT,
    -- What changed, as DATA — { "from": "OPEN", "to": "TRIAGED" } — never a
    -- pre-rendered sentence. The timeline is read by a person now and by a
    -- classifier later, and a sentence is the one form neither can query.
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportEvent_caseId_createdAt_idx" ON "SupportEvent"("caseId", "createdAt");

-- ── Knowledge base ─────────────────────────────────────────────────────────
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeCategory_slug_key" ON "KnowledgeCategory"("slug");

CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    -- Plain text with light markdown. No HTML and no rich-text editor: this
    -- renders in a React app AND a native one, and HTML would need sanitising
    -- in both.
    "body" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    -- Unpublished is invisible to users and readable in admin. A draft that is
    -- live is worse than no article.
    "published" BOOLEAN NOT NULL DEFAULT false,
    -- NULL = everyone. Otherwise the hat it is written for, so an owner is
    -- never offered "how to book a viewing".
    "audience" "SupportAuthorRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");
CREATE INDEX "KnowledgeArticle_categoryId_published_idx" ON "KnowledgeArticle"("categoryId", "published");

-- ── Existing tables ────────────────────────────────────────────────────────

-- Coarse staff role, matching PropertyStatusEvent.actor's precedent: a small
-- closed vocabulary as TEXT, because adding an enum value costs two migrations.
-- Every existing admin keeps full access — the default is ADMIN, and nothing
-- reads this for authorisation yet. It exists so assignment can grow queues.
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';

-- The integration point. NULLABLE, so every existing report keeps working
-- before the backfill; UNIQUE, so a case belongs to at most one report.
ALTER TABLE "PropertyReport" ADD COLUMN "supportCaseId" TEXT;
CREATE UNIQUE INDEX "PropertyReport_supportCaseId_key" ON "PropertyReport"("supportCaseId");

-- ON DELETE SET NULL, never CASCADE: deleting a case must not delete the report
-- it was created for. The report is the RECORD; the case is the workflow.
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_supportCaseId_fkey"
    FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReportMessage, created one migration earlier on this same branch, folds into
-- SupportMessage. Two message tables for one concept is the duplication rule
-- this refactor exists to avoid, and the table has never held a row anywhere —
-- 20260810020000 was written today and has not been applied to any database, so
-- this is free now and expensive later. IF EXISTS because a developer who
-- pulled mid-branch may not have it.
DROP TABLE IF EXISTS "ReportMessage";

-- ── Foreign keys ───────────────────────────────────────────────────────────
-- Every actor/subject reference is SET NULL rather than CASCADE. A case must
-- outlive the people and listings it is about: deleting an account (DPDP) drops
-- the personal link, and the moderation record — which may be the evidence that
-- an account was removed for cause — survives it. Only the case's OWN children
-- cascade, because a message with no case is not a fact about anything.
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_relatedUserId_fkey"
    FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_relatedPropertyId_fkey"
    FOREIGN KEY ("relatedPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_relatedAppointmentId_fkey"
    FOREIGN KEY ("relatedAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_relatedConversationId_fkey"
    FOREIGN KEY ("relatedConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_relatedLeaseId_fkey"
    FOREIGN KEY ("relatedLeaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorAdminId_fkey"
    FOREIGN KEY ("authorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "SupportMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_uploadedByAdminId_fkey"
    FOREIGN KEY ("uploadedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportEvent" ADD CONSTRAINT "SupportEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportEvent" ADD CONSTRAINT "SupportEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportEvent" ADD CONSTRAINT "SupportEvent_actorAdminId_fkey"
    FOREIGN KEY ("actorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
