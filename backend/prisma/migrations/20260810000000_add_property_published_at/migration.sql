-- When a listing first went LIVE, which is not when its row was created.
--
-- A listing is created as DRAFT, published to PENDING by its owner, and only
-- becomes ACTIVE when an admin approves it. `createdAt` therefore answers
-- "when did somebody start typing", and the supply question is "when could a
-- renter see it" — for a listing that sat in review for three days those are
-- different weeks.
--
-- DELIBERATELY NOT BACKFILLED. Every existing row would have to be guessed
-- from `updatedAt`, which has since moved for every edit, every moderation
-- action and every score recalculation. A wrong date that looks precise is
-- worse than a null: NULL reads as "went live before we measured", which is
-- exactly true. The supply chart is honest from today and cannot be made
-- honest about yesterday.
--
-- Set ONCE, on the first transition into ACTIVE, and never cleared — a listing
-- paused and relisted has not been published twice. Time spent live is a
-- different question and needs the status-change log this project has decided
-- not to build yet.
ALTER TABLE "Property" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- The supply trend groups by week over this column and filters out nulls.
CREATE INDEX "Property_publishedAt_idx" ON "Property"("publishedAt");
