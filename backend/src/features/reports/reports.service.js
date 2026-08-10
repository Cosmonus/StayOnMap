import { prisma } from '../../lib/prisma.js'
import { recordStatusChange } from '../properties/statusEvents.js'
import { recalculateRiskScore } from '../trust/trust.service.js'
import { notifyUser } from '../notifications/notifications.service.js'

// Auto-suspend needs corroboration from this many *distinct, identified*
// reporters. Severity alone is client-supplied on a public endpoint, so acting
// on it directly let anyone suspend any listing by filing two CRITICAL reports.
// Anonymous reports still raise the risk score and reach the moderation queue —
// they just can't take a listing down on their own.
const MIN_DISTINCT_REPORTERS_TO_SUSPEND = 2

export async function submitReport(reporterId, propertyId, data) {
  const report = await prisma.propertyReport.create({ data: { ...data, reporterId: data.isAnonymous ? null : reporterId, propertyId } })

  await recalculateRiskScore(propertyId)

  // Freeze high/critical severity properties, but only once independent
  // reporters agree — see MIN_DISTINCT_REPORTERS_TO_SUSPEND above.
  if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
    const risk = await prisma.propertyRiskScore.findUnique({ where: { propertyId } })
    if (risk?.level === 'HIGH' || risk?.level === 'SUSPICIOUS') {
      const corroborating = await prisma.propertyReport.findMany({
        where: { propertyId, severity: { in: ['HIGH', 'CRITICAL'] }, reporterId: { not: null } },
        select: { reporterId: true },
        distinct: ['reporterId'],
      })
      if (corroborating.length >= MIN_DISTINCT_REPORTERS_TO_SUSPEND) {
        // Re-read rather than trusting the caller: auto-suspension can fire on
        // a listing in any status, and logging a `from` we assumed would put a
        // transition in the chart that never happened.
        const before = await prisma.property.findUnique({ where: { id: propertyId }, select: { status: true } })
        await prisma.property.update({ where: { id: propertyId }, data: { status: 'SUSPENDED' } })
        recordStatusChange({ propertyId, from: before?.status, to: 'SUSPENDED', actor: 'system' })
      }
    }
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } })
  if (property && !data.isAnonymous) {
    await notifyUser(property.ownerId, { type: 'REPORT_SUBMITTED', title: 'A concern was raised about your property', body: 'A user has reported a concern. Our team will review it.', referenceId: report.id, referenceType: 'PropertyReport', audience: 'OWNER' })
  }

  return report
}

export async function adminListReports({ status, severity, category, page = 1, limit = 20 }) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 20)
  const where = {}
  if (status) where.status = status
  if (severity) where.severity = severity
  if (category) where.category = category
  const skip = (pageNum - 1) * limitNum
  const [reports, total] = await Promise.all([
    prisma.propertyReport.findMany({
      where, skip, take: limitNum,
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: { property: { select: { id: true, title: true, city: true } }, moderationAction: true },
    }),
    prisma.propertyReport.count({ where }),
  ])
  return { reports, total, page: pageNum, limit: limitNum }
}

export async function getOwnerReports(ownerId, propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId }, select: { id: true } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return prisma.propertyReport.findMany({
    where: { propertyId },
    select: { id: true, category: true, severity: true, status: true, description: true, ownerResponse: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function respondToReport(ownerId, propertyId, reportId, ownerResponse) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId }, select: { id: true } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  const report = await prisma.propertyReport.findUnique({ where: { id: reportId, propertyId } })
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })
  return prisma.propertyReport.update({ where: { id: reportId }, data: { ownerResponse } })
}

export async function adminModerateReport(reportId, adminId, { action, note }) {
  const report = await prisma.propertyReport.findUnique({ where: { id: reportId } })
  if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 })

  const STATUS_MAP = {
    APPROVE:     'RESOLVED',
    REJECT:      'DISMISSED',
    SUSPEND:     'UNDER_REVIEW',
    INVESTIGATE: 'UNDER_REVIEW',
    DISMISS:     'DISMISSED',
    WARN_OWNER:  'RESOLVED',
  }
  const newStatus = STATUS_MAP[action] ?? 'UNDER_REVIEW'

  const [updatedReport] = await prisma.$transaction([
    prisma.propertyReport.update({ where: { id: reportId }, data: { status: newStatus } }),
    prisma.moderationAction.create({ data: { reportId, adminId, action, note } }),
  ])

  if (action === 'SUSPEND') {
    const before = await prisma.property.findUnique({ where: { id: report.propertyId }, select: { status: true } })
    await prisma.property.update({ where: { id: report.propertyId }, data: { status: 'SUSPENDED' } })
    recordStatusChange({ propertyId: report.propertyId, from: before?.status, to: 'SUSPENDED', actor: 'admin' })
  }
  // Points only when a moderator UPHOLDS the report (RESOLVED) — never on
  // submit, and never on DISMISSED. Paying for filed reports would fund exactly
  // the false-report farming the risk score is vulnerable to (severity is
  // client-supplied). Anonymous reports have no reporterId and earn nothing;
  // that's the honest trade for anonymity. Idempotent per (user, report).
  if (newStatus === 'RESOLVED' && report.reporterId) {
    const { awardPoints } = await import('../points/points.service.js')
    awardPoints(report.reporterId, 'REPORT_UPHELD', reportId).catch(() => {})
  }
  if (action === 'DISMISS' || action === 'REJECT') {
    await recalculateRiskScore(report.propertyId)
  }
  if (action === 'WARN_OWNER') {
    const property = await prisma.property.findUnique({ where: { id: report.propertyId }, select: { ownerId: true } })
    if (property) {
      await notifyUser(property.ownerId, { type: 'TRUST_ALERT', title: 'Admin Warning', body: note || 'You have received a warning from the admin regarding your property.', referenceId: reportId, referenceType: 'PropertyReport', audience: 'OWNER' })
    }
  }

  // Tell the person who reported it. Added 2026-08-10, and until then a report
  // went into SILENCE: the owner was notified on submit, the owner was notified
  // on a warning, and the reporter was told nothing at any point — not even
  // when their report was upheld and they were quietly paid points for it.
  //
  // "We looked and did nothing" is a real answer and is sent too. The failure
  // mode of reporting is not a wrong verdict, it is no verdict: someone reports
  // a fraudulent listing, hears nothing for a week, and concludes that
  // reporting does not work — which costs the next report, not this one.
  //
  // WHAT IT DOES NOT SAY IS THE CAREFUL PART. The wording is the same whether
  // the listing was suspended, the owner was warned, or nothing happened at
  // all. Confirming to a reporter that they got a listing taken down turns the
  // report button into a scoreboard, and gives anyone testing how to remove a
  // competitor a reliable signal to test against. `note` is an internal
  // moderator note and is never forwarded.
  //
  // Anonymous reports have no reporterId and get nothing — the same honest
  // trade as the points rule directly above.
  const REPORTER_OUTCOME = {
    RESOLVED:  'Thanks — we reviewed your report and have acted on it.',
    DISMISSED: 'We reviewed your report and did not find a breach of our rules. Thank you for flagging it.',
  }
  if (report.reporterId && REPORTER_OUTCOME[newStatus]) {
    await notifyUser(report.reporterId, {
      type: 'REPORT_UPDATE',
      title: 'Your report was reviewed',
      body: REPORTER_OUTCOME[newStatus],
      referenceId: reportId,
      referenceType: 'PropertyReport',
      // The reporter is wearing their renter hat — an owner reporting someone
      // else's listing is still acting as a renter when they do it.
      audience: 'TENANT',
    })
  }

  return updatedReport
}
