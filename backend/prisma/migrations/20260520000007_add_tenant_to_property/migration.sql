-- Migration 2: Add currentTenantId and occupiedSince to Property
ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "currentTenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "occupiedSince"   TIMESTAMP(3);

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_currentTenantId_fkey"
  FOREIGN KEY ("currentTenantId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Property_currentTenantId_idx" ON "Property"("currentTenantId");
