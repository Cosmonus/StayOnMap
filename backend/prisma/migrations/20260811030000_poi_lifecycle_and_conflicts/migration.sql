-- POI lifecycle and conflict recording.
--
-- The problem this closes, stated plainly: `removeStalePois()` hard-DELETED
-- every row a clean re-fetch did not return. A shop that closes, is retagged,
-- or is re-mapped under a new osmId left no trace at all — so "which businesses
-- closed near this listing last year" was unanswerable from our own data at any
-- price, and would stay unanswerable no matter how long we ran. Deletion is the
-- one data loss that cannot be repaired later.
--
-- Nothing here changes what a user sees. The read path (poiProvider.js) filters
-- `status = 'ACTIVE'`, so a row marked ABSENT_FROM_SOURCE is exactly as
-- invisible as a deleted one was — it is simply still there to count.
--
-- ADDITIVE ONLY. No column is dropped, no row is deleted, and every existing
-- query keeps working unchanged.

-- ─────────────────────────────────────────────────────────────────
-- PoiIndex — four columns
-- ─────────────────────────────────────────────────────────────────

-- DEFAULT 'ACTIVE' backfills every existing row correctly: they are all rows a
-- fetch returned and nothing has since marked absent.
ALTER TABLE "PoiIndex" ADD COLUMN "status" "PoiStatus" NOT NULL DEFAULT 'ACTIVE';

-- Why the status is what it is, in our own words, e.g. "not returned by the
-- 2026-08-11 Bengaluru fetch". Free text rather than a second enum: the useful
-- part is WHICH run, and enumerating run identities is not a vocabulary.
ALTER TABLE "PoiIndex" ADD COLUMN "statusReason" TEXT;

-- Null means "never changed" — true of every row that exists today, and a
-- meaning worth keeping distinct from "changed at the moment of the migration".
ALTER TABLE "PoiIndex" ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- When we FIRST saw this place. Deliberately NOT backfilled, following
-- `Property.publishedAt`'s precedent (migration 20260810000000): every existing
-- row would have to be guessed from `fetchedAt`, which has moved on every
-- re-seed since, and a wrong date that looks precise is worse than a NULL that
-- honestly means "here before we started counting".
--
-- Note there is NO `lastSeenAt` column: `fetchedAt` already is one. It is
-- rewritten on every upsert, create and update alike, so it means exactly "the
-- last run that returned this row". A second column holding the same number is
-- a second copy free to drift.
ALTER TABLE "PoiIndex" ADD COLUMN "firstSeenAt" TIMESTAMP(3);

-- The serving read path's access path, now that it carries a status predicate.
-- Category first because that is what every module query narrows on first.
CREATE INDEX "PoiIndex_status_category_idx" ON "PoiIndex"("status", "category");

-- ─────────────────────────────────────────────────────────────────
-- PoiStatusEvent — append-only existence history
-- ─────────────────────────────────────────────────────────────────

-- Modelled on PropertyStatusEvent (migration 20260810010000) and for the same
-- reason: `status` is one column that overwrites itself, so the moment a POI
-- goes ABSENT_FROM_SOURCE the evidence it was ever ACTIVE is gone. A place that
-- disappears and comes back — which happens constantly in OSM, because a
-- mapper retags a node and another mapper reverts it — is indistinguishable
-- from one that never moved unless the transitions themselves are recorded.
--
-- This is what makes "businesses opening / closing / moving" measurable, which
-- is the whole reason the deletion had to stop.
CREATE TABLE "PoiStatusEvent" (
    "id"         TEXT NOT NULL,
    "poiIndexId" TEXT NOT NULL,
    -- Nullable: the first event has nothing before it.
    "fromStatus" "PoiStatus",
    "toStatus"   "PoiStatus" NOT NULL,
    "reason"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoiStatusEvent_pkey" PRIMARY KEY ("id")
);

-- Two reads: one POI's history, and everything in a date window (the churn
-- rollup — how many places went absent in this city this quarter).
CREATE INDEX "PoiStatusEvent_poiIndexId_createdAt_idx" ON "PoiStatusEvent"("poiIndexId", "createdAt");
CREATE INDEX "PoiStatusEvent_toStatus_createdAt_idx" ON "PoiStatusEvent"("toStatus", "createdAt");

ALTER TABLE "PoiStatusEvent" ADD CONSTRAINT "PoiStatusEvent_poiIndexId_fkey"
    FOREIGN KEY ("poiIndexId") REFERENCES "PoiIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- PoiConflict — a disagreement, recorded rather than silently resolved
-- ─────────────────────────────────────────────────────────────────

-- Until now the seed's upsert replaced name, category, lat and lng with
-- whatever the latest fetch said. A hospital's coordinate moving four
-- kilometres was applied in silence and the previous value was gone, so
-- afterwards nothing could tell a correction from an error, or from vandalism.
--
-- `applied` and `status` answer DIFFERENT questions and both are needed:
--   applied — what the ingestion mechanically did at detection time
--   status  — what a reviewer later decided about it
-- Collapsing them loses the ability to ask "what did we apply that turned out
-- to be wrong", which is the only way this table ever improves the thresholds.
CREATE TABLE "PoiConflict" (
    "id"         TEXT NOT NULL,
    "poiIndexId" TEXT NOT NULL,
    -- 'location' | 'name' | 'category' — the attribute that disagreed.
    "attribute"  TEXT NOT NULL,
    -- Rendered as text rather than typed columns: one table covers every
    -- attribute, and the values are for a human to read, never to compute on.
    "currentValue"  TEXT,
    "incomingValue" TEXT,
    -- Which source asserted the incoming value. One source today ('osm'), which
    -- is exactly why this column exists — a conflict between two sources and a
    -- conflict between two observations from one source are different findings.
    "source"     TEXT NOT NULL,
    -- Magnitude, for location conflicts. Null for everything else — a name
    -- change has no distance, and 0 would read as "it did not move".
    "distanceM"  INTEGER,
    -- Did ingestion take the incoming value? False means we KEPT the stored one
    -- (an implausible jump), which is the withhold path.
    "applied"    BOOLEAN NOT NULL DEFAULT true,
    "status"     "PoiConflictStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "PoiConflict_pkey" PRIMARY KEY ("id")
);

-- One POI's disagreements, newest first.
CREATE INDEX "PoiConflict_poiIndexId_detectedAt_idx" ON "PoiConflict"("poiIndexId", "detectedAt");
-- The review queue: what is still OPEN.
CREATE INDEX "PoiConflict_status_detectedAt_idx" ON "PoiConflict"("status", "detectedAt");
-- The rollup: conflict rate by attribute, which is what tunes the thresholds.
CREATE INDEX "PoiConflict_attribute_detectedAt_idx" ON "PoiConflict"("attribute", "detectedAt");

ALTER TABLE "PoiConflict" ADD CONSTRAINT "PoiConflict_poiIndexId_fkey"
    FOREIGN KEY ("poiIndexId") REFERENCES "PoiIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
