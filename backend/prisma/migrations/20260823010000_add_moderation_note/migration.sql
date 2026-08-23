-- Why a listing was rejected/paused, when, and when its owner last edited it.
-- The reason used to exist only inside a notification; the edit stamp is what
-- lets publishProperty refuse an unchanged resubmission of a REJECTED listing.
ALTER TABLE "Property" ADD COLUMN "moderationNote" TEXT;
ALTER TABLE "Property" ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN "ownerEditedAt" TIMESTAMP(3);
