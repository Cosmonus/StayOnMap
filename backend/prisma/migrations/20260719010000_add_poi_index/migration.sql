-- CreateTable
CREATE TABLE "PoiIndex" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "city" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoiIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoiIndex_osmId_key" ON "PoiIndex"("osmId");

-- CreateIndex
CREATE INDEX "PoiIndex_category_lat_lng_idx" ON "PoiIndex"("category", "lat", "lng");

-- CreateIndex
CREATE INDEX "PoiIndex_city_idx" ON "PoiIndex"("city");
