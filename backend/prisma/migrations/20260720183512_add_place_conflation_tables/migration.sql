-- DropIndex
DROP INDEX "SpatialContext_geohash_prefix_idx";

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceSource" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "name" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "category" TEXT,
    "confidence" DECIMAL(4,3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Place_city_category_idx" ON "Place"("city", "category");

-- CreateIndex
CREATE INDEX "Place_category_lat_lng_idx" ON "Place"("category", "lat", "lng");

-- CreateIndex
CREATE INDEX "PlaceSource_placeId_idx" ON "PlaceSource"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSource_source_sourceKey_key" ON "PlaceSource"("source", "sourceKey");

-- CreateIndex
CREATE INDEX "SpatialContext_geohash_prefix_idx" ON "SpatialContext"("geohash" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "PlaceSource" ADD CONSTRAINT "PlaceSource_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
