-- Property.geohash — the join key between a listing and the spatial layer.
-- Nullable and backfilled separately (scripts/backfill-property-geohash.mjs)
-- so this migration stays instant on a large table.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "geohash" TEXT;
CREATE INDEX IF NOT EXISTS "Property_geohash_idx" ON "Property"("geohash");

-- Per-cell, per-category proximity summary. Derived data: safe to truncate and
-- recompute. Exists so proximity can be FILTERED on, which JSON in
-- SpatialContext.modules cannot be.
CREATE TABLE IF NOT EXISTS "CellPoiSummary" (
    "id"         TEXT NOT NULL,
    "geohash"    TEXT NOT NULL,
    "category"   TEXT NOT NULL,
    "nearestM"   INTEGER,
    "count800M"  INTEGER NOT NULL DEFAULT 0,
    "count1600M" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellPoiSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CellPoiSummary_geohash_category_key"
    ON "CellPoiSummary"("geohash", "category");

-- The filter's access path: narrow by category, then by the distance predicate.
CREATE INDEX IF NOT EXISTS "CellPoiSummary_category_nearestM_idx"
    ON "CellPoiSummary"("category", "nearestM");
