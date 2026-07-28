-- Water bodies as polygons — closes the `water_distance` input shared by the
-- terrain and environment modules. See the WaterBody model in schema.prisma.
--
-- No enum values are added here, so this needs no second migration (the
-- add-value-then-use split in .claude/database.md does not apply).

CREATE TABLE "WaterBody" (
    "id"         TEXT NOT NULL,
    "osmId"      TEXT NOT NULL,
    "name"       TEXT,
    "kind"       TEXT NOT NULL,
    "city"       TEXT,
    "source"     TEXT NOT NULL DEFAULT 'openstreetmap',
    "geometry"   JSONB NOT NULL,
    "areaSqM"    DOUBLE PRECISION,
    "minLat"     DECIMAL(10,7) NOT NULL,
    "maxLat"     DECIMAL(10,7) NOT NULL,
    "minLng"     DECIMAL(10,7) NOT NULL,
    "maxLng"     DECIMAL(10,7) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterBody_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaterBody_osmId_key" ON "WaterBody"("osmId");

-- Nearest-water is a bbox INTERSECTION test, not Boundary's containment test,
-- so both axes are indexed.
CREATE INDEX "WaterBody_minLat_maxLat_idx" ON "WaterBody"("minLat", "maxLat");
CREATE INDEX "WaterBody_minLng_maxLng_idx" ON "WaterBody"("minLng", "maxLng");
CREATE INDEX "WaterBody_city_idx" ON "WaterBody"("city");
