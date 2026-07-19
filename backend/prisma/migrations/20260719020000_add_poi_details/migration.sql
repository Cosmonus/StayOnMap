-- AlterTable: opening hours + brand/operator, straight from OSM tags where a
-- mapper recorded them. Nullable — sparse in India, shown only when present.
ALTER TABLE "PoiIndex" ADD COLUMN "brand" TEXT;
ALTER TABLE "PoiIndex" ADD COLUMN "openingHours" TEXT;
