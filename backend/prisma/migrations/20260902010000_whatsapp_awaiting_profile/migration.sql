-- A WhatsApp listing confirmed by its owner but held until their profile is
-- complete (a verified email, in practice). Enum value ALONE — Postgres cannot
-- use a value in the transaction that added it.
ALTER TYPE "WhatsAppConversationStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PROFILE';
