-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyType" ADD VALUE 'LAND';
ALTER TYPE "PropertyType" ADD VALUE 'SHORT_STAY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationDocType" ADD VALUE 'GST';
ALTER TYPE "VerificationDocType" ADD VALUE 'TRADE_LICENSE';
ALTER TYPE "VerificationDocType" ADD VALUE 'PATTA_TITLE';
ALTER TYPE "VerificationDocType" ADD VALUE 'HOMESTAY_PERMIT';
