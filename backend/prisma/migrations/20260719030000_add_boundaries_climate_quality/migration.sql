-- CreateTable
CREATE TABLE "Boundary" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT,
    "adminLevel" INTEGER NOT NULL,
    "city" TEXT,
    "source" TEXT NOT NULL DEFAULT 'openstreetmap',
    "geometry" JSONB NOT NULL,
    "minLat" DECIMAL(10,7) NOT NULL,
    "maxLat" DECIMAL(10,7) NOT NULL,
    "minLng" DECIMAL(10,7) NOT NULL,
    "maxLng" DECIMAL(10,7) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherNormal" (
    "id" TEXT NOT NULL,
    "geohash" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "variable" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'open-meteo-era5',
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherNormal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityReport" (
    "id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "scope" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL,
    "completenessPct" DOUBLE PRECISION,
    "complete" BOOLEAN NOT NULL DEFAULT true,
    "notes" JSONB,

    CONSTRAINT "DataQualityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Boundary_osmId_key" ON "Boundary"("osmId");

-- CreateIndex
CREATE INDEX "Boundary_adminLevel_minLat_maxLat_idx" ON "Boundary"("adminLevel", "minLat", "maxLat");

-- CreateIndex
CREATE INDEX "Boundary_city_idx" ON "Boundary"("city");

-- CreateIndex
CREATE INDEX "WeatherNormal_geohash_idx" ON "WeatherNormal"("geohash");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherNormal_geohash_variable_month_key" ON "WeatherNormal"("geohash", "variable", "month");

-- CreateIndex
CREATE INDEX "DataQualityReport_dataset_runAt_idx" ON "DataQualityReport"("dataset", "runAt");

