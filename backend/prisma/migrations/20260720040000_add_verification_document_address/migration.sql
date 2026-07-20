-- The property address as printed on the ownership document, owner-declared at
-- verification submission. Compared deterministically against the listing
-- address (pincode exact-match + token overlap) and surfaced to the reviewing
-- admin — no machine ever reads the document image itself.
ALTER TABLE "OwnershipVerification" ADD COLUMN IF NOT EXISTS "documentAddress" TEXT;
