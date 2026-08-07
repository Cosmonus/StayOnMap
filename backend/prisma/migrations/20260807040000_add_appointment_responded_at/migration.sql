-- When the owner FIRST answered a visit request: accepted, declined or moved it.
--
-- Existing rows stay NULL on purpose. There is no honest backfill: `updatedAt`
-- is the only other timestamp and it moves on every later edit, so filling this
-- from it would invent response times that were never measured — and the whole
-- point of the column is that the number it feeds is measured rather than
-- assumed. features/trust/responsiveness.js reads a NULL row's STATUS to tell
-- whether the owner answered, and simply omits it from the speed median.
ALTER TABLE "Appointment" ADD COLUMN "respondedAt" TIMESTAMP(3);
