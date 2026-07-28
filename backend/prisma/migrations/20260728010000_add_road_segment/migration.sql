-- Motorable roads as lines — closes `road_access` for the landContext module.
-- See the RoadSegment model in schema.prisma. No enum values, so no split
-- migration is needed (.claude/database.md's add-value-then-use rule).

CREATE TABLE "RoadSegment" (
    "id"         TEXT NOT NULL,
    "osmId"      TEXT NOT NULL,
    "name"       TEXT,
    "highway"    TEXT NOT NULL,
    "widthM"     DOUBLE PRECISION,
    "paved"      BOOLEAN,
    "city"       TEXT,
    "source"     TEXT NOT NULL DEFAULT 'openstreetmap',
    "geometry"   JSONB NOT NULL,
    "minLat"     DECIMAL(10,7) NOT NULL,
    "maxLat"     DECIMAL(10,7) NOT NULL,
    "minLng"     DECIMAL(10,7) NOT NULL,
    "maxLng"     DECIMAL(10,7) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoadSegment_osmId_key" ON "RoadSegment"("osmId");

-- Class first: the nearest-road scan asks for the nearest DRIVEABLE road before
-- it asks for the nearest anything.
CREATE INDEX "RoadSegment_highway_minLat_maxLat_idx" ON "RoadSegment"("highway", "minLat", "maxLat");
CREATE INDEX "RoadSegment_minLat_maxLat_idx" ON "RoadSegment"("minLat", "maxLat");
CREATE INDEX "RoadSegment_minLng_maxLng_idx" ON "RoadSegment"("minLng", "maxLng");
CREATE INDEX "RoadSegment_city_idx" ON "RoadSegment"("city");
