import { prisma } from '../../lib/prisma.js'
import { addMessage, getCaseForUser } from '../support/supportCase.service.js'
import { VISIBILITY, ROLE } from '../support/visibility.js'
import { notifyUser } from '../notifications/notifications.service.js'

/**
 * The reporter ↔ moderator conversation on a property report.
 *
 * NOW AN ADAPTER. The storage moved to SupportMessage on 2026-08-10; this file
 * keeps the exact same five exports so the routes, controllers and tests that
 * were written against it are unchanged. That is the point — the report thread
 * was working, and "do not rewrite working functionality" applies to its
 * INTERFACE even when the thing underneath it is unified.
 *
 * What did NOT change:
 *   · A reporter reaches their thread by REPORT id, because that is what the
 *     notification carries.
 *   · The lookup is scoped by reporterId, and a report that is not yours
 *     answers 404 rather than 403 — the id must not become a probe.
 *   · The OWNER is not a party. There is still no owner-side function here,
 *     and the visibility layer refuses TENANT_ONLY to an owner independently.
 *   · An anonymous report cannot be replied to.
 *
 * What improved by moving: these messages now sit on a case that can be
 * assigned, prioritised, escalated and audited, and they appear in the same
 * admin inbox as every other kind of request.
 */

export const REPORTER = ROLE.TENANT
export const ADMIN = ROLE.ADMIN

const notFound = () => Object.assign(new Error('Report not found'), { statusCode: 404 })

/**
 * Resolve a report id to its case, scoped to its reporter.
 *
 * findFirst with BOTH ids: the ownership check IS the query, so there is no
 * path where it can be forgotten.
 */
async function ownCaseId(reportId, userId) {
  const report = await prisma.propertyReport.findFirst({
    where: { id: reportId, reporterId: userId },
    select: { id: true, supportCaseId: true, category: true, status: true, createdAt: true, propertyId: true },
  })
  if (!report) throw notFound()
  return report
}

/** The reporter's own thread. Throws 404 for anyone else's report. */
export async function getThreadForReporter(reportId, userId) {
  const report = await ownCaseId(reportId, userId)

  // A report with no case predates the backfill, or was written while the
  // support layer was briefly unavailable. It is not an error: the report is
  // real and its own status is the source of truth, so it renders as a thread
  // with nothing in it rather than a failure.
  if (!report.supportCaseId) {
    return { report: shapeReport(report), messages: [] }
  }

  // Delegated, so visibility and read-marking have exactly one implementation.
  const supportCase = await getCaseForUser(report.supportCaseId, userId)

  return {
    report: shapeReport(report),
    messages: supportCase.messages.map(toReportMessage),
  }
}

/** The reporter adds detail. */
export async function addReporterMessage(reportId, userId, body) {
  const report = await ownCaseId(reportId, userId)
  if (!report.supportCaseId) {
    throw Object.assign(
      new Error('This report is being reviewed the old way and cannot take replies. Please contact support.'),
      { statusCode: 409, expose: true },
    )
  }
  const message = await addMessage(report.supportCaseId, { role: ROLE.TENANT, userId }, body)
  return toReportMessage(message)
}

/** The moderator's view. No ownership scope — that is what being an admin is. */
export async function getThreadForAdmin(reportId) {
  const report = await prisma.propertyReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, isAnonymous: true, status: true, supportCaseId: true },
  })
  if (!report) throw notFound()

  const messages = report.supportCaseId
    ? await prisma.supportMessage.findMany({
      where: { caseId: report.supportCaseId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, authorRole: true, body: true, visibility: true, createdAt: true,
        authorAdminId: true, readByUserAt: true, readByAdminAt: true,
      },
    })
    : []

  if (report.supportCaseId) {
    await prisma.supportMessage.updateMany({
      where: { caseId: report.supportCaseId, authorRole: ROLE.TENANT, readByAdminAt: null },
      data: { readByAdminAt: new Date() },
    })
  }

  return {
    messages: messages.map(toReportMessage),
    // Stated up front rather than inferred from reporterId by the UI: an
    // anonymous report has nobody to reply TO, and a reply box that silently
    // discards what a moderator typed is worse than no reply box.
    canReply: !!report.reporterId && !!report.supportCaseId,
    supportCaseId: report.supportCaseId,
  }
}

/** A moderator replies, and the reporter is told. */
export async function addAdminMessage(reportId, adminId, body) {
  const report = await prisma.propertyReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, supportCaseId: true },
  })
  if (!report) throw notFound()

  if (!report.reporterId) {
    throw Object.assign(
      new Error('This report was filed anonymously, so there is nobody to reply to.'),
      { statusCode: 400, expose: true },
    )
  }
  if (!report.supportCaseId) {
    throw Object.assign(
      new Error('This report has no support case yet. Refresh and try again.'),
      { statusCode: 409, expose: true },
    )
  }

  // TENANT_ONLY, not PUBLIC. On a property-report case the owner is a party,
  // and a moderator's answer to the reporter must never reach the person the
  // report is about — the notification and the visibility rule are two
  // independent defences and both are needed.
  //
  // `notify: false` because this path sends its own, below. The generic
  // support notification references the CASE; released clients map
  // referenceType 'PropertyReport' to the report thread and would deep-link
  // nowhere on a 'SupportCase'. Preserving that contract is the whole reason
  // this adapter exists.
  const message = await addMessage(
    report.supportCaseId,
    { role: ROLE.ADMIN, adminId },
    body,
    VISIBILITY.TENANT_ONLY,
    { notify: false },
  )

  // Unchanged from before the support layer: same type, same referenceType,
  // same absence of the reply text — a lock-screen preview must not carry
  // moderation text, and it should be read where it is marked read.
  await notifyUser(report.reporterId, {
    type: 'REPORT_UPDATE',
    title: 'A moderator replied to your report',
    body: 'Open your report to read it and reply.',
    referenceId: reportId,
    referenceType: 'PropertyReport',
    audience: 'TENANT',
  })

  return toReportMessage(message)
}

/**
 * Reports with a reporter message the moderators have not read.
 *
 * The admin side has no notification stream, so without this a reporter's reply
 * lands in a thread nobody opens.
 */
export async function reportsAwaitingModerator() {
  const rows = await prisma.supportMessage.findMany({
    where: { authorRole: ROLE.TENANT, readByAdminAt: null, case: { report: { isNot: null } } },
    select: { case: { select: { report: { select: { id: true } } } } },
    distinct: ['caseId'],
  })
  return rows.map((r) => r.case?.report?.id).filter(Boolean)
}

// ── Shape adapters ─────────────────────────────────────────────────────────
// The clients were written against the report thread's field names and are
// released; renaming them here would be a wire-format change for no gain.

const toReportMessage = (m) => ({
  id: m.id,
  // REPORTER | ADMIN, which is what both clients branch on. SUPPORT_AGENT maps
  // to ADMIN because to a reporter there is no difference — and SYSTEM does
  // too, so a status line never renders as if the reporter wrote it.
  authorRole: m.authorRole === ROLE.TENANT ? 'REPORTER' : 'ADMIN',
  body: m.body,
  createdAt: m.createdAt,
  readByReporterAt: m.readByUserAt ?? null,
  readByAdminAt: m.readByAdminAt ?? null,
})

const shapeReport = (r) => ({
  id: r.id, category: r.category, status: r.status,
  createdAt: r.createdAt, propertyId: r.propertyId,
})
