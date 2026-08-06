-- The renter's half of the exchange. `ownerNote` has always existed; there was
-- no field at all for the renter to say WHY they want a different time, so a
-- counter-offer would have arrived as a bare date change.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tenantNote" TEXT;
