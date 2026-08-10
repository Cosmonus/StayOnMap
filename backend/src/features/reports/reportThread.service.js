import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'

// The conversation on a report: reporter ↔ moderator, and nobody else.
//
// Two access rules do all the work here, and both are enforced on every call
// rather than at the edge:
//
//   1. The reporter side is scoped by `reporterId`, so a report id — which is
//      a cuid, but is also handed to the client in a notification payload —
//      cannot be used to read somebody else's thread.
//   2. THE OWNER IS NOT A PARTY. There is deliberately no owner-side function
//      in this file, and `getOwnerReports` (reports.service.js) does not select
//      messages. A report can be anonymous and the owner already cannot see who
//      filed one; a thread the owner could read would undo that directly.

export const REPORTER = 'REPORTER'
export const ADMIN = 'ADMIN'

const MESSAGE_SELECT = {
  id: true, authorRole: true, body: true, createdAt: true,
  readByReporterAt: true, readByAdminAt: true,
}

/** The reporter's own thread. Throws 404 for anyone else's report. */
export async function getThreadForReporter(reportId, userId) {
  // findFirst with BOTH ids, not findUnique-then-compare: the ownership check
  // is the query, so there is no path where it can be forgotten.
  const report = await prisma.propertyReport.findFirst({
    where: { id: reportId, reporterId: userId },
    select: { id: true, category: true, status: true, createdAt: true, propertyId: true },
  })
  // 404 rather than 403 — "this is not yours" and "this does not exist" should
  // be indistinguishable, or the id becomes a probe.
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })

  const messages = await prisma.reportMessage.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    select: MESSAGE_SELECT,
  })

  // Reading IS reading: clear the admin-side messages the reporter has now seen.
  await prisma.reportMessage.updateMany({
    where: { reportId, authorRole: ADMIN, readByReporterAt: null },
    data: { readByReporterAt: new Date() },
  })

  return { report, messages }
}

/** The reporter adds detail. */
export async function addReporterMessage(reportId, userId, body) {
  const report = await prisma.propertyReport.findFirst({
    where: { id: reportId, reporterId: userId },
    select: { id: true },
  })
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })

  // No notification fires here. Admins have no notification stream — they work
  // from the queue — so the unread count on the admin side is what surfaces
  // this, and inventing a notify target would mean inventing an admin recipient.
  return prisma.reportMessage.create({
    data: { reportId, authorRole: REPORTER, body },
    select: MESSAGE_SELECT,
  })
}

/** The moderator's view. No ownership scope — that is what being an admin is. */
export async function getThreadForAdmin(reportId) {
  const report = await prisma.propertyReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, isAnonymous: true, status: true },
  })
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })

  const messages = await prisma.reportMessage.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    select: { ...MESSAGE_SELECT, adminId: true },
  })

  await prisma.reportMessage.updateMany({
    where: { reportId, authorRole: REPORTER, readByAdminAt: null },
    data: { readByAdminAt: new Date() },
  })

  // `canReply` rather than letting the UI infer it from `reporterId`: an
  // anonymous report has nobody to reply TO, and a reply box that silently
  // discards what you typed is worse than no reply box.
  return { messages, canReply: !!report.reporterId }
}

/** A moderator replies, and the reporter is told. */
export async function addAdminMessage(reportId, adminId, body) {
  const report = await prisma.propertyReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true },
  })
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })

  // An anonymous report has no reporter, so a reply would be written into a
  // thread nobody can ever open. Refused rather than stored: a moderator who
  // typed an answer deserves to know it cannot be delivered.
  if (!report.reporterId) {
    throw Object.assign(
      new Error('This report was filed anonymously, so there is nobody to reply to.'),
      { statusCode: 400, expose: true },
    )
  }

  const message = await prisma.reportMessage.create({
    data: { reportId, authorRole: ADMIN, adminId, body },
    select: MESSAGE_SELECT,
  })

  // Awaited, unlike most notifications in this codebase: the whole point of the
  // reply is that the reporter finds out about it, and a message they are never
  // told about is the silence this feature exists to end.
  //
  // The BODY is not put in the notification. It goes in the thread, and the
  // notification says a reply exists — so a push preview on a lock screen never
  // carries moderation text, and the reporter reads it in the one place that
  // marks it read.
  await notifyUser(report.reporterId, {
    type: 'REPORT_UPDATE',
    title: 'A moderator replied to your report',
    body: 'Open your report to read it and reply.',
    referenceId: reportId,
    referenceType: 'PropertyReport',
    // The reporter is wearing their renter hat — an owner reporting somebody
    // else's listing is still acting as a renter when they do it.
    audience: 'TENANT',
  })

  return message
}

/**
 * Reports with a reporter message the moderators have not read.
 *
 * The admin side has no notification stream, so without this a reporter's reply
 * lands in a thread nobody opens. Returned as a set of report ids for the
 * Reports list to badge, which is cheaper than joining messages onto every row.
 */
export async function reportsAwaitingModerator() {
  const rows = await prisma.reportMessage.findMany({
    where: { authorRole: REPORTER, readByAdminAt: null },
    select: { reportId: true },
    distinct: ['reportId'],
  })
  return rows.map((r) => r.reportId)
}
