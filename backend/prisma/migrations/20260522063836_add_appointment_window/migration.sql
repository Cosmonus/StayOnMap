-- DropIndex
DROP INDEX "Property_currentTenantId_idx";

-- AlterTable
ALTER TABLE "ActivityLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Amenity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CommunityReview" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FraudSignal" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lease" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ModerationAction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NeighborhoodInsight" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OwnershipVerification" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "appointmentWindowEnd" TEXT,
ADD COLUMN     "appointmentWindowStart" TEXT,
ALTER COLUMN "pincode" DROP DEFAULT,
ALTER COLUMN "state" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PropertyImage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PropertyReport" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PropertyRiskScore" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PropertyRule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrustScore" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VerificationDocument" ALTER COLUMN "id" DROP DEFAULT;
