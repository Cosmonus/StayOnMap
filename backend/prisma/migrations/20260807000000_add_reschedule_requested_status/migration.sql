-- A renter proposing a different time is not the same event as an owner moving
-- one. RESCHEDULED carries `scheduledAt` and `ownerNote` — both the owner's
-- voice — so reusing it for a counter-offer would have put the renter's words
-- on the owner's card.
--
-- Its own migration: PostgreSQL cannot USE a newly-added enum value in the same
-- transaction that adds it, so the column that stores the renter's note lands
-- in 20260807010000.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUESTED';
