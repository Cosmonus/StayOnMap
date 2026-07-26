-- What an owner's listing page needs to report reach and review state.
--
-- `viewCount` counts detail-page views by anyone who is NOT the owner (see
-- properties.service.js) — an owner refreshing their own listing is not
-- interest, and a number that inflates when you look at it is worse than none.
--
-- `submittedAt` exists because updatedAt could not carry it: any later edit
-- moves updatedAt, and "Submitted 4 hours ago" has to mean submitted.
-- Backfilled for listings already awaiting review so the label isn't blank on
-- the ones it was built for.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "viewCount"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

UPDATE "Property" SET "submittedAt" = "updatedAt"
WHERE "status" = 'PENDING' AND "submittedAt" IS NULL;
