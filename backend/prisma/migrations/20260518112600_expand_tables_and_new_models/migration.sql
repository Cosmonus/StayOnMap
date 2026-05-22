-- Step 2: Modify existing tables and create new models
-- Enum values from step 1 are committed, so they are safe to use here.

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('ANY', 'MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ReviewerType" AS ENUM ('TENANT', 'PREVIOUS_TENANT', 'NEIGHBOR', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('WATER_SHORTAGE', 'SAFETY_CONCERN', 'QUIET_AREA', 'FAMILY_FRIENDLY', 'STUDENT_FRIENDLY', 'TRAFFIC', 'TRANSPORT', 'NOISE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FRAUD', 'FAKE_PHOTOS', 'UNAUTHORIZED_LISTING', 'WRONG_PRICING', 'UNSAFE', 'ILLEGAL', 'HARASSMENT', 'OWNER_MISCONDUCT', 'DUPLICATE', 'FALSE_INFO', 'NOISE', 'WATER', 'SECURITY', 'BROKER_SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationDocType" AS ENUM ('GOVT_ID', 'PROPERTY_TAX', 'UTILITY_BILL', 'RENTAL_AGREEMENT', 'AADHAAR', 'PAN', 'SELFIE', 'OTHER');

-- CreateEnum
CREATE TYPE "FraudSignalType" AS ENUM ('DUPLICATE_ADDRESS', 'SIMILAR_GEOLOCATION', 'REUSED_IMAGES', 'SAME_CONTACT', 'SIMILAR_DESCRIPTION', 'AI_FLAGGED');

-- CreateEnum
CREATE TYPE "TrustBadge" AS ENUM ('VERIFIED_OWNER', 'COMMUNITY_TRUSTED', 'HIGHLY_RECOMMENDED', 'VERIFIED_NEIGHBORHOOD', 'LOW_COMPLAINT', 'UNDER_REVIEW', 'SUSPICIOUS', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REJECT', 'SUSPEND', 'INVESTIGATE', 'DISMISS', 'WARN_OWNER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REQUEST', 'APPOINTMENT_STATUS', 'REPORT_SUBMITTED', 'REPORT_UPDATE', 'VERIFICATION_UPDATE', 'TRUST_ALERT', 'SYSTEM');

-- AlterTable: Property — drop old columns, add new ones
ALTER TABLE "Property"
  DROP COLUMN IF EXISTS "amenities",
  DROP COLUMN IF EXISTS "images",
  DROP COLUMN IF EXISTS "parking",
  ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "brokerage" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "electricityCharges" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "landmark" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseDuration" INTEGER,
  ADD COLUMN IF NOT EXISTS "maintenance" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "occupancyLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "pincode" TEXT NOT NULL DEFAULT '000000',
  ADD COLUMN IF NOT EXISTS "sharing" INTEGER,
  ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "waterCharges" DECIMAL(10,2);

ALTER TABLE "Property" ALTER COLUMN "furnished" SET DEFAULT 'UNFURNISHED';
ALTER TABLE "Property" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "Property" ALTER COLUMN "bhk" DROP NOT NULL;

-- AlterTable: User — add new columns
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Admin
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Amenity
CREATE TABLE IF NOT EXISTS "Amenity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PropertyImage
CREATE TABLE IF NOT EXISTS "PropertyImage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PropertyAmenity
CREATE TABLE IF NOT EXISTS "PropertyAmenity" (
    "propertyId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable: PropertyRule
CREATE TABLE IF NOT EXISTS "PropertyRule" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "bachelorAllowed" BOOLEAN NOT NULL DEFAULT true,
    "familyPreferred" BOOLEAN NOT NULL DEFAULT false,
    "visitorsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "curfewTime" TEXT,
    "genderPreference" "GenderPreference" NOT NULL DEFAULT 'ANY',
    "foodPreference" TEXT,
    "alcoholAllowed" BOOLEAN NOT NULL DEFAULT false,
    "noiseRestrictions" TEXT,
    CONSTRAINT "PropertyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Appointment
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestedTime" TEXT NOT NULL,
    "message" TEXT,
    "contactNumber" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "ownerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommunityReview
CREATE TABLE IF NOT EXISTS "CommunityReview" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerType" "ReviewerType" NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "recommend" BOOLEAN NOT NULL,
    "ratingsSafety" INTEGER NOT NULL,
    "ratingsClean" INTEGER NOT NULL,
    "ratingsWater" INTEGER NOT NULL,
    "ratingsNoise" INTEGER NOT NULL,
    "ratingsInternet" INTEGER NOT NULL,
    "ratingsParking" INTEGER NOT NULL,
    "ratingsNeighborhood" INTEGER NOT NULL,
    "ratingsTransport" INTEGER NOT NULL,
    "ratingsMaintenance" INTEGER NOT NULL,
    "ratingsOwnerBehavior" INTEGER NOT NULL,
    "ratingsSecurity" INTEGER NOT NULL,
    "ratingsPowerBackup" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RecommendationVote
CREATE TABLE IF NOT EXISTS "RecommendationVote" (
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommend" BOOLEAN NOT NULL,
    CONSTRAINT "RecommendationVote_pkey" PRIMARY KEY ("propertyId","userId")
);

-- CreateTable: NeighborhoodInsight
CREATE TABLE IF NOT EXISTS "NeighborhoodInsight" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" "InsightCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NeighborhoodInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PropertyReport
CREATE TABLE IF NOT EXISTS "PropertyReport" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "reporterId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" "ReportCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ReportSeverity" NOT NULL,
    "evidenceUrls" TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OwnershipVerification
CREATE TABLE IF NOT EXISTS "OwnershipVerification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnershipVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VerificationDocument
CREATE TABLE IF NOT EXISTS "VerificationDocument" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "verificationId" TEXT NOT NULL,
    "type" "VerificationDocType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrustScore
CREATE TABLE IF NOT EXISTS "TrustScore" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cleanlinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neighborhoodScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "recommendCount" INTEGER NOT NULL DEFAULT 0,
    "notRecommendCount" INTEGER NOT NULL DEFAULT 0,
    "recommendPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" "TrustBadge",
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PropertyRiskScore
CREATE TABLE IF NOT EXISTS "PropertyRiskScore" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "complaintCount" INTEGER NOT NULL DEFAULT 0,
    "unauthorizedReports" INTEGER NOT NULL DEFAULT 0,
    "duplicateSignals" INTEGER NOT NULL DEFAULT 0,
    "verificationLevel" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FraudSignal
CREATE TABLE IF NOT EXISTS "FraudSignal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "propertyId" TEXT NOT NULL,
    "type" "FraudSignalType" NOT NULL,
    "detail" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ModerationAction
CREATE TABLE IF NOT EXISTS "ModerationAction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "reportId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ActivityLog
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Amenity_name_key" ON "Amenity"("name");
CREATE INDEX IF NOT EXISTS "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyRule_propertyId_key" ON "PropertyRule"("propertyId");
CREATE INDEX IF NOT EXISTS "Appointment_propertyId_idx" ON "Appointment"("propertyId");
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_idx" ON "Appointment"("tenantId");
CREATE INDEX IF NOT EXISTS "Appointment_ownerId_idx" ON "Appointment"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_tenantId_propertyId_status_key" ON "Appointment"("tenantId", "propertyId", "status");
CREATE INDEX IF NOT EXISTS "CommunityReview_propertyId_idx" ON "CommunityReview"("propertyId");
CREATE INDEX IF NOT EXISTS "CommunityReview_status_idx" ON "CommunityReview"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReview_reviewerId_propertyId_key" ON "CommunityReview"("reviewerId", "propertyId");
CREATE INDEX IF NOT EXISTS "NeighborhoodInsight_propertyId_idx" ON "NeighborhoodInsight"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyReport_propertyId_idx" ON "PropertyReport"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyReport_status_idx" ON "PropertyReport"("status");
CREATE INDEX IF NOT EXISTS "PropertyReport_severity_idx" ON "PropertyReport"("severity");
CREATE UNIQUE INDEX IF NOT EXISTS "OwnershipVerification_propertyId_key" ON "OwnershipVerification"("propertyId");
CREATE INDEX IF NOT EXISTS "OwnershipVerification_status_idx" ON "OwnershipVerification"("status");
CREATE INDEX IF NOT EXISTS "OwnershipVerification_ownerId_idx" ON "OwnershipVerification"("ownerId");
CREATE INDEX IF NOT EXISTS "VerificationDocument_verificationId_idx" ON "VerificationDocument"("verificationId");
CREATE UNIQUE INDEX IF NOT EXISTS "TrustScore_propertyId_key" ON "TrustScore"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyRiskScore_propertyId_key" ON "PropertyRiskScore"("propertyId");
CREATE INDEX IF NOT EXISTS "FraudSignal_propertyId_idx" ON "FraudSignal"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "ModerationAction_reportId_key" ON "ModerationAction"("reportId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_adminId_idx" ON "ActivityLog"("adminId");
CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Property_type_idx" ON "Property"("type");

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyRule" ADD CONSTRAINT "PropertyRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NeighborhoodInsight" ADD CONSTRAINT "NeighborhoodInsight_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NeighborhoodInsight" ADD CONSTRAINT "NeighborhoodInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnershipVerification" ADD CONSTRAINT "OwnershipVerification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "OwnershipVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustScore" ADD CONSTRAINT "TrustScore_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyRiskScore" ADD CONSTRAINT "PropertyRiskScore_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PropertyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
