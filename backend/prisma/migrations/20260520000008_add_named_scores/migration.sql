-- Add AreaScore, WaterScore, FloodSafe to TrustScore table
ALTER TABLE "TrustScore"
  ADD COLUMN IF NOT EXISTS "areaScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "waterScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "floodSafeRating" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create OwnerTrustScore table
CREATE TABLE IF NOT EXISTS "OwnerTrustScore" (
  "id"                TEXT             NOT NULL,
  "ownerId"           TEXT             NOT NULL,
  "score"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "level"             TEXT             NOT NULL DEFAULT 'UNRATED',
  "responseRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewAvg"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "verificationLevel" INTEGER          NOT NULL DEFAULT 0,
  "updatedAt"         TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "OwnerTrustScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OwnerTrustScore_ownerId_key" ON "OwnerTrustScore"("ownerId");

ALTER TABLE "OwnerTrustScore"
  ADD CONSTRAINT "OwnerTrustScore_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
