-- CreateEnum
CREATE TYPE "PointsAction" AS ENUM ('EMAIL_VERIFIED', 'PHONE_VERIFIED', 'PROFILE_COMPLETED', 'REVIEW_APPROVED', 'INSIGHT_ADDED', 'REPORT_UPHELD', 'LEASE_SIGNED');

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PointsAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "referenceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointsLedger_userId_idx" ON "PointsLedger"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_userId_action_referenceId_key" ON "PointsLedger"("userId", "action", "referenceId");

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
