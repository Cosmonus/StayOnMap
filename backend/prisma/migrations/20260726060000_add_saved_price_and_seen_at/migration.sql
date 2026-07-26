-- What a saved list needs to be worth returning to.
--
-- `rentAtSave`: the price when they saved it, so the list can say "₹2,000
-- cheaper than when you saved". Not derived from PropertyPriceHistory — nothing
-- writes to that table yet, and it could never answer this for saves made
-- before it started. Null on existing rows, which renders as no claim.
ALTER TABLE "SavedListing" ADD COLUMN IF NOT EXISTS "rentAtSave" DECIMAL(12,2);

-- `savedSeenAt`: when they last opened the list, so "since you last looked" is
-- measured rather than approximated as "in the last week".
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "savedSeenAt" TIMESTAMP(3);
