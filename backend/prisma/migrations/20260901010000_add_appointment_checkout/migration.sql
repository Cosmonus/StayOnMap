-- SHORT_STAY stay requests carry a date range: requestedDate is the check-in,
-- checkOutDate the check-out, nights are [requestedDate, checkOutDate).
-- Nullable: every visit request (and every existing row) has no range.
ALTER TABLE "Appointment" ADD COLUMN "checkOutDate" TIMESTAMP(3);
