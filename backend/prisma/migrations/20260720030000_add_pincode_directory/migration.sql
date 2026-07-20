-- India Post's pincode directory: the ground truth a listing's location claims
-- are checked against. One row per post office (~155k), several per pincode.
-- Additive and safe; seeded separately by scripts/fetch-pincode-directory.mjs.
CREATE TABLE IF NOT EXISTS "PincodeDirectory" (
    "id"         TEXT NOT NULL,
    "pincode"    TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "officeType" TEXT,
    "delivery"   BOOLEAN NOT NULL DEFAULT true,
    "taluk"      TEXT,
    "division"   TEXT,
    "region"     TEXT,
    "circle"     TEXT,
    "district"   TEXT NOT NULL,
    "state"      TEXT NOT NULL,
    "fetchedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PincodeDirectory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PincodeDirectory_pincode_officeName_key"
    ON "PincodeDirectory"("pincode", "officeName");

CREATE INDEX IF NOT EXISTS "PincodeDirectory_pincode_idx"
    ON "PincodeDirectory"("pincode");
