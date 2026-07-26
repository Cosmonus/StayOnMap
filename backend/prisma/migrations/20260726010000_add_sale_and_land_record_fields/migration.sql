-- Sale-specific listing facts, the Indian land-record identifiers, and the
-- money-column widening a crore-scale asking price needs.

-- ── Money: Decimal(10,2) tops out at ₹9,99,99,999.99. A ₹10Cr+ flat in Mumbai
-- or Delhi is ordinary, and the old cap would have rejected the listing rather
-- than rounding it. Numeric precision growth is a metadata-only change here.
ALTER TABLE "Property" ALTER COLUMN "rent"    TYPE DECIMAL(12,2);
ALTER TABLE "Property" ALTER COLUMN "deposit" TYPE DECIMAL(12,2);

-- ── SALE: the three questions a buyer asks that a rental listing never does.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "possessionStatus" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "priceNegotiable"  BOOLEAN;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "loanEligible"     BOOLEAN;

-- ── LAND RECORDS: how the state identifies the land. Never returned on a
-- public property response — see the schema comment on surveyNumber.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "surveyNumber"      TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "subdivisionNumber" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "landRecordType"    TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "landRecordNumber"  TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "conversionStatus"  TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ecAvailable"       BOOLEAN;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ecYears"           INTEGER;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "guidelineValue"    DECIMAL(12,2);

-- Buyers filter on these three the way renters filter on rent.
CREATE INDEX IF NOT EXISTS "Property_possessionStatus_idx" ON "Property"("possessionStatus");
CREATE INDEX IF NOT EXISTS "Property_loanEligible_idx"     ON "Property"("loanEligible");
CREATE INDEX IF NOT EXISTS "Property_conversionStatus_idx" ON "Property"("conversionStatus");
