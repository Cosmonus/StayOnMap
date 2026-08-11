-- The tenancy-record notification type, and NOTHING ELSE (the Postgres
-- enum rule — .claude/database.md). Tables follow in 20260812010000.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TENANCY_UPDATE';
