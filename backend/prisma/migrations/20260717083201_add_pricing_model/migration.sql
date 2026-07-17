-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('RENT', 'LEASE');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "pricingModel" "PricingModel" NOT NULL DEFAULT 'RENT';

-- CreateIndex
CREATE INDEX "Property_pricingModel_idx" ON "Property"("pricingModel");
