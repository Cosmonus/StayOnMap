-- Migration 2 of 2: Add missing columns, tables, and indexes

-- User: new columns
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "bio"               TEXT,
  ADD COLUMN IF NOT EXISTS "displayId"         TEXT,
  ADD COLUMN IF NOT EXISTS "emailNotifs"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pushNotifs"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "listingVisibility" "ListingVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "socialLinks"       JSONB;

-- Property: new columns
ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "displayId"        TEXT,
  ADD COLUMN IF NOT EXISTS "facingDirection"  "FacingDirection",
  ADD COLUMN IF NOT EXISTS "floor"            INTEGER,
  ADD COLUMN IF NOT EXISTS "totalFloors"      INTEGER;

-- PropertyRule: new column
ALTER TABLE "PropertyRule"
  ADD COLUMN IF NOT EXISTS "nonVegAllowed" BOOLEAN NOT NULL DEFAULT false;

-- Unique indexes for displayId
CREATE UNIQUE INDEX IF NOT EXISTS "User_displayId_key"     ON "User"("displayId");
CREATE UNIQUE INDEX IF NOT EXISTS "Property_displayId_key" ON "Property"("displayId");

-- Conversation table (persisted chat rooms)
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id"            TEXT         NOT NULL,
  "propertyId"    TEXT         NOT NULL,
  "tenantId"      TEXT         NOT NULL,
  "ownerId"       TEXT         NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        IF NOT EXISTS "Conversation_tenantId_idx"          ON "Conversation"("tenantId");
CREATE INDEX        IF NOT EXISTS "Conversation_ownerId_idx"           ON "Conversation"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_propertyId_tenantId_key" ON "Conversation"("propertyId", "tenantId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Message table
CREATE TABLE IF NOT EXISTS "Message" (
  "id"             TEXT         NOT NULL,
  "conversationId" TEXT         NOT NULL,
  "senderId"       TEXT         NOT NULL,
  "body"           TEXT         NOT NULL,
  "isRead"         BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx"       ON "Message"("senderId");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
