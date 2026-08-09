-- Every status change a listing goes through, so supply can be measured NET.
--
-- `Property.publishedAt` (added hours earlier) records arrival and nothing
-- else, so the supply chart could show listings appearing and never leaving —
-- a line that only goes up, describing a market where nothing is ever rented,
-- paused or removed. Net change is the number a marketplace lives on and it is
-- not derivable after the fact: `status` is a single column that overwrites
-- itself, so the moment a listing goes OCCUPIED the evidence that it was ever
-- ACTIVE is gone.
--
-- An append-only log rather than more columns on Property, because the
-- questions worth asking are about the transitions themselves: how long a
-- listing stays live before it rents, how often a paused listing comes back,
-- how much of this week's churn was moderation rather than tenancy.
--
-- `actor` is a coarse label (owner / admin / system), never a user id. Who
-- suspended a listing is already in ActivityLog with the admin attached; this
-- table is for counting, and a personal id here would make a metrics table into
-- a second, weaker audit trail with its own retention question.
CREATE TABLE "PropertyStatusEvent" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    -- Nullable: the very first event has nothing before it.
    "fromStatus" "PropertyStatus",
    "toStatus"   "PropertyStatus" NOT NULL,
    "actor"      TEXT NOT NULL DEFAULT 'system',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyStatusEvent_pkey" PRIMARY KEY ("id")
);

-- The two reads: one listing's history, and everything in a date window.
CREATE INDEX "PropertyStatusEvent_propertyId_createdAt_idx" ON "PropertyStatusEvent"("propertyId", "createdAt");
CREATE INDEX "PropertyStatusEvent_createdAt_idx" ON "PropertyStatusEvent"("createdAt");
-- The supply chart asks "what left ACTIVE this week" — a partial-ish access
-- path for that predicate without scanning the whole log.
CREATE INDEX "PropertyStatusEvent_toStatus_createdAt_idx" ON "PropertyStatusEvent"("toStatus", "createdAt");

-- CASCADE: a status history for a listing that no longer exists is not a fact
-- about anything, and the aggregate it fed was always a count of live changes.
ALTER TABLE "PropertyStatusEvent" ADD CONSTRAINT "PropertyStatusEvent_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
