-- WhatsApp listing automation (2026-08-25).
--
-- 1. User.email becomes nullable. An owner who lists over WhatsApp has proven a
--    phone number, not an inbox. Postgres treats NULLs as distinct under a
--    UNIQUE index, so this changes nothing for existing rows and lets any number
--    of email-less accounts coexist. No data is touched.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- 2. The conversation state machine, the message log (whose unique waMessageId
--    is the webhook idempotency guarantee) and single-use sign-in links.
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('START', 'PROPERTY_TYPE', 'QUESTIONNAIRE', 'LOCATION', 'PHOTOS', 'REVIEW', 'CONFIRMATION', 'VERIFICATION', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'SENT', 'SEND_FAILED');

CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'START',
    "propertyType" TEXT,
    "currentQuestion" TEXT,
    "draft" JSONB NOT NULL DEFAULT '{}',
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "propertyId" TEXT,
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "waMessageId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppLoginLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppLoginLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE UNIQUE INDEX "WhatsAppLoginLink_tokenHash_key" ON "WhatsAppLoginLink"("tokenHash");

CREATE INDEX "WhatsAppConversation_phone_status_idx" ON "WhatsAppConversation"("phone", "status");
CREATE INDEX "WhatsAppConversation_status_lastMessageAt_idx" ON "WhatsAppConversation"("status", "lastMessageAt");
CREATE INDEX "WhatsAppConversation_userId_idx" ON "WhatsAppConversation"("userId");
CREATE INDEX "WhatsAppConversation_propertyId_idx" ON "WhatsAppConversation"("propertyId");
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
CREATE INDEX "WhatsAppMessage_phone_createdAt_idx" ON "WhatsAppMessage"("phone", "createdAt");
CREATE INDEX "WhatsAppLoginLink_userId_idx" ON "WhatsAppLoginLink"("userId");
CREATE INDEX "WhatsAppLoginLink_expiresAt_idx" ON "WhatsAppLoginLink"("expiresAt");

ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppLoginLink" ADD CONSTRAINT "WhatsAppLoginLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
