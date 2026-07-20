-- DropIndex
DROP INDEX "SpatialContext_geohash_prefix_idx";

-- AlterTable
ALTER TABLE "CellPoiSummary" ADD COLUMN     "nearestWalkM" INTEGER;

-- CreateIndex
CREATE INDEX "SpatialContext_geohash_prefix_idx" ON "SpatialContext"("geohash" text_pattern_ops);
