-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "approvalStatus" TEXT,
ADD COLUMN     "availableBeds" INTEGER,
ADD COLUMN     "beds" INTEGER,
ADD COLUMN     "carpetArea" DECIMAL(10,2),
ADD COLUMN     "cleaningFee" DECIMAL(10,2),
ADD COLUMN     "commercialType" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "extent" DECIMAL(10,2),
ADD COLUMN     "extentUnit" TEXT,
ADD COLUMN     "frontage" DECIMAL(10,2),
ADD COLUMN     "houseStyle" TEXT,
ADD COLUMN     "instantBook" BOOLEAN,
ADD COLUMN     "landType" TEXT,
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "maxNights" INTEGER,
ADD COLUMN     "minNights" INTEGER,
ADD COLUMN     "nightlyRate" DECIMAL(10,2),
ADD COLUMN     "noticePeriodDays" INTEGER,
ADD COLUMN     "placeType" TEXT,
ADD COLUMN     "powerLoad" TEXT,
ADD COLUMN     "roadWidth" DECIMAL(10,2),
ADD COLUMN     "saleOrLease" TEXT,
ADD COLUMN     "totalBeds" INTEGER,
ADD COLUMN     "weekendRate" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "businessSince" TIMESTAMP(3),
ADD COLUMN     "isBusiness" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityBlock_propertyId_idx" ON "AvailabilityBlock"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityBlock_propertyId_date_key" ON "AvailabilityBlock"("propertyId", "date");

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
