-- The saved-search match notification type, and NOTHING ELSE.
--
-- Its own migration because Postgres cannot USE an enum value in the same
-- transaction that added it (Prisma P3018; `.claude/database.md` states the
-- rule). The SavedSearch table and the matcher that emits this both come
-- after, in 20260811070000.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SAVED_SEARCH_MATCH';
