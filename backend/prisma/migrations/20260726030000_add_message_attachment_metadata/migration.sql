-- Document attachments in chat. `attachmentUrl` already existed but was
-- image-only in practice: a PDF rendered through an <img> tag is a broken
-- image icon, and with a UUID storage path there was nothing to label it with.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentMime" TEXT;
