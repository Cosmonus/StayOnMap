-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'FACEBOOK', 'LINKEDIN', 'TWITTER');

-- DropIndex
DROP INDEX "PoiIndex_sourceTag_idx";

-- DropIndex
DROP INDEX "SpatialContext_geohash_prefix_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "avatarUrl" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prevTokenHash" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_provider_providerUserId_key" ON "SocialAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_userId_provider_key" ON "SocialAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_prevTokenHash_key" ON "AuthSession"("prevTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SpatialContext_geohash_prefix_idx" ON "SpatialContext"("geohash" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
