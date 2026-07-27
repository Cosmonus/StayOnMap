-- Which hat a notification is addressed to. See the comment on
-- Notification.audience in schema.prisma.
--
-- A brand-new enum TYPE plus a column using it is safe in one migration — the
-- "cannot use a newly added enum value in the same transaction" rule in
-- .claude/database.md is about ALTER TYPE ... ADD VALUE on an EXISTING enum,
-- which this is not.
CREATE TYPE "NotificationAudience" AS ENUM ('TENANT', 'OWNER');

-- Nullable with NO backfill, deliberately: existing rows predate the
-- distinction and there is no honest way to assign them a hat. NULL reads as
-- "unclassified" and is shown in BOTH modes, so no one loses a notification
-- they already have.
ALTER TABLE "Notification" ADD COLUMN "audience" "NotificationAudience";

CREATE INDEX "Notification_userId_audience_idx" ON "Notification"("userId", "audience");
