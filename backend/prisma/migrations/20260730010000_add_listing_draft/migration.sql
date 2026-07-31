-- The add-listing wizard's unfinished draft, moved off the device it was
-- started on. No enum changes here, so a single migration is correct
-- (see .claude/database.md's PostgreSQL enum gotcha for when it isn't).
CREATE TABLE "ListingDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingDraft_pkey" PRIMARY KEY ("id")
);

-- One draft slot per owner. This is what makes the upsert safe when a phone
-- and a laptop push within the same second.
CREATE UNIQUE INDEX "ListingDraft_userId_key" ON "ListingDraft"("userId");

ALTER TABLE "ListingDraft" ADD CONSTRAINT "ListingDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
