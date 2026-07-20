-- DropIndex
DROP INDEX "SpatialContext_geohash_prefix_idx";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SpatialContext_geohash_prefix_idx" ON "SpatialContext"("geohash" text_pattern_ops);
