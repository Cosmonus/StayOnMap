-- New NotificationType values for the support layer, and NOTHING ELSE.
--
-- Its own migration because Postgres cannot USE an enum value in the same
-- transaction that added it (Prisma error P3018, and `.claude/database.md`
-- states the rule). The migration that creates the support tables and the code
-- that emits these notifications both come after this one.
--
-- Three values, not one per event. A notification type is a DELIVERY category —
-- it decides push and email routing in notifications.service.js — not a log of
-- what happened; that is what SupportEvent is for. Adding a type per event
-- would make the push allow-list a second, drifting copy of the timeline.
--
--   SUPPORT_CASE_MESSAGE  somebody replied to you on a case
--   SUPPORT_CASE_UPDATE   status, assignment or a request for information
--   SUPPORT_CASE_RESOLVED terminal outcome, and the one people wait for
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_CASE_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_CASE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_CASE_RESOLVED';
