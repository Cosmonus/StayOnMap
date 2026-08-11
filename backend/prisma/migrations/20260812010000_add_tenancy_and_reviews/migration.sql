-- Somebody LIVED here, from when to when — the record vacateProperty()
-- destroys today by nulling currentTenantId/occupiedSince. Same class of fix
-- as PropertyStatusEvent: the live columns overwrite themselves, the record
-- does not. TenancyReview is double-blind at READ time (reveal.js), so no
-- revealedAt column and no scheduler.
CREATE TYPE "TenancySource" AS ENUM ('LEASE', 'MARKED');

CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "TenancySource" NOT NULL,
    "leaseId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenancy_leaseId_key" ON "Tenancy"("leaseId");
CREATE INDEX "Tenancy_tenantId_idx" ON "Tenancy"("tenantId");
CREATE INDEX "Tenancy_ownerId_idx" ON "Tenancy"("ownerId");
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SetNull: a lease row disappearing must not erase the fact somebody lived here.
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TenancyReview" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenancyReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenancyReview_tenancyId_authorId_key" ON "TenancyReview"("tenancyId", "authorId");
CREATE INDEX "TenancyReview_targetId_idx" ON "TenancyReview"("targetId");

ALTER TABLE "TenancyReview" ADD CONSTRAINT "TenancyReview_tenancyId_fkey"
    FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenancyReview" ADD CONSTRAINT "TenancyReview_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenancyReview" ADD CONSTRAINT "TenancyReview_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
