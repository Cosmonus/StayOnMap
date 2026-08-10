-- A conversation between the person who filed a report and a moderator.
--
-- Until now a report went into SILENCE. `createReport` notified the OWNER,
-- moderation notified the OWNER on a warning, and the reporter was told nothing
-- at any point — not even when their report was upheld and they were quietly
-- awarded points for it. Outcome notifications (same day) closed half of that.
-- This closes the other half: a moderator had no way to ask "which listing,
-- what exactly happened", and a reporter had no way to add the detail that
-- would have made the report actionable.
--
-- NOT the `Conversation` model. That one is tenant<->owner, and admins are
-- platform operators rather than participants — putting an admin inside it
-- would mean rewriting the notification audience split, the per-hat unread
-- counts and the socket rooms, for one moderation surface. This is a
-- moderation record that happens to have replies, and it lives on the report.
--
-- THE OWNER IS NOT A PARTY AND MUST NEVER BECOME ONE. Reports can be anonymous,
-- the owner already cannot see who filed one, and a thread the owner could read
-- would undo that in the most direct way available.
CREATE TABLE "ReportMessage" (
    "id"       TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    -- REPORTER | ADMIN. Text rather than an enum, following
    -- PropertyStatusEvent.actor: a new enum value costs two migrations
    -- (Postgres cannot use a value in the transaction that created it), and
    -- this vocabulary is closed at two by the design, not by a constraint.
    "authorRole" TEXT NOT NULL,
    -- Set only on an ADMIN message, for accountability. A reporter message
    -- needs no author column: the report already knows whose it is, and
    -- copying reporterId here would let the two disagree.
    "adminId"  TEXT,
    "body"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- When the OTHER side last read this message. Nullable on both, because an
    -- unread message and a message read at an unknown time are different facts.
    "readByReporterAt" TIMESTAMP(3),
    "readByAdminAt"    TIMESTAMP(3),

    CONSTRAINT "ReportMessage_pkey" PRIMARY KEY ("id")
);

-- The only read there is: one report's thread, oldest first.
CREATE INDEX "ReportMessage_reportId_createdAt_idx" ON "ReportMessage"("reportId", "createdAt");

-- CASCADE: a thread about a report that no longer exists is not a fact about
-- anything. Matches PropertyReport's own cascade from Property.
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "PropertyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
