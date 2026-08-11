-- Backfill the record from what the live columns still know. Idempotent: both
-- inserts guard on an existing row, so running twice writes nothing new.
--
-- Signed leases become CONFIRMED tenancies — signing was the tenant's
-- agreement, and stamping confirmedAt = signedAt keeps the history honest
-- about WHEN. An ACTIVE lease is an ongoing tenancy; TERMINATED/EXPIRED end at
-- terminatedAt, else the lease's own endDate.
INSERT INTO "Tenancy" ("id", "propertyId", "ownerId", "tenantId", "source", "leaseId", "startedAt", "endedAt", "confirmedAt")
SELECT
    gen_random_uuid()::text,
    l."propertyId", l."ownerId", l."tenantId",
    'LEASE'::"TenancySource",
    l."id",
    l."startDate",
    CASE WHEN l."status" = 'ACTIVE' THEN NULL ELSE COALESCE(l."terminatedAt", l."endDate") END,
    l."signedAt"
FROM "Lease" l
WHERE l."signedAt" IS NOT NULL
  AND l."status" IN ('ACTIVE', 'TERMINATED', 'EXPIRED')
  AND NOT EXISTS (SELECT 1 FROM "Tenancy" t WHERE t."leaseId" = l."id");

-- Marked-as-rented listings become UNCONFIRMED tenancies: they were an
-- owner's assertion, and no tenant has agreed to them yet. They surface as a
-- confirm prompt on the tenant's own Rented view (pull, not a retroactive
-- push) and count for nothing until confirmed. Skipped where the same
-- (property, tenant) already has an ongoing lease-born tenancy.
INSERT INTO "Tenancy" ("id", "propertyId", "ownerId", "tenantId", "source", "startedAt", "confirmedAt")
SELECT
    gen_random_uuid()::text,
    p."id", p."ownerId", p."currentTenantId",
    'MARKED'::"TenancySource",
    COALESCE(p."occupiedSince", CURRENT_TIMESTAMP),
    NULL
FROM "Property" p
WHERE p."status" = 'OCCUPIED'
  AND p."currentTenantId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Tenancy" t
    WHERE t."propertyId" = p."id" AND t."tenantId" = p."currentTenantId" AND t."endedAt" IS NULL
  );
