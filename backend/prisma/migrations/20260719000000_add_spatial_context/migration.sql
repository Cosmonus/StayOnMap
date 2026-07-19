-- CreateTable
CREATE TABLE "SpatialContext" (
    "id" TEXT NOT NULL,
    "geohash" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "city" TEXT,
    "modules" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staleAfter" TIMESTAMP(3) NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpatialContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyPriceHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "rent" DECIMAL(10,2) NOT NULL,
    "deposit" DECIMAL(10,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpatialContext_geohash_key" ON "SpatialContext"("geohash");

-- CreateIndex
CREATE INDEX "SpatialContext_city_idx" ON "SpatialContext"("city");

-- CreateIndex
CREATE INDEX "SpatialContext_staleAfter_idx" ON "SpatialContext"("staleAfter");

-- CreateIndex
CREATE INDEX "PropertyPriceHistory_propertyId_recordedAt_idx" ON "PropertyPriceHistory"("propertyId", "recordedAt");

-- AddForeignKey
ALTER TABLE "PropertyPriceHistory" ADD CONSTRAINT "PropertyPriceHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prefix scans ("all cells in this area") are `geohash LIKE 'tdr1%'`. Postgres
-- won't use the default btree index for that under a non-C collation, so the
-- coarse-grained query needs its own text_pattern_ops index. This is the index
-- that replaces what a spatial extension would otherwise be doing here.
CREATE INDEX "SpatialContext_geohash_prefix_idx" ON "SpatialContext" ("geohash" text_pattern_ops);
