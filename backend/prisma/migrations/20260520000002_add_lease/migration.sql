-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('OFFERED', 'ACTIVE', 'REJECTED', 'TERMINATED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Lease" (
    "id"            TEXT NOT NULL,
    "propertyId"    TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "ownerId"       TEXT NOT NULL,
    "appointmentId" TEXT,
    "startDate"     TIMESTAMP(3) NOT NULL,
    "endDate"       TIMESTAMP(3) NOT NULL,
    "rentAmount"    DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "status"        "LeaseStatus" NOT NULL DEFAULT 'OFFERED',
    "ownerNote"     TEXT,
    "tenantNote"    TEXT,
    "signedAt"      TIMESTAMP(3),
    "rejectedAt"    TIMESTAMP(3),
    "terminatedAt"  TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX "Lease_ownerId_idx" ON "Lease"("ownerId");
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease" ADD CONSTRAINT "Lease_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
