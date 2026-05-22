-- CreateEnum
CREATE TYPE "ContactVisibility" AS ENUM ('EVERYONE', 'LOGGED_IN', 'NOBODY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contactVisibility" "ContactVisibility" NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showExactLocation" BOOLEAN NOT NULL DEFAULT true;
