import { prisma } from '../../lib/prisma.js'
import { recalculateRiskScore } from '../trust/trust.service.js'
import { notifyUser } from '../notifications/notifications.service.js'

export async function submitReport(reporterId, propertyId, data) {
  const report = await prisma.propertyReport.create({ data: { ...data, reporterId: data.isAnonymous ? null : reporterId, propertyId } })

  await recalculateRiskScore(propertyId)

  // Freeze high/critical severity properties
  if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
    const risk = await prisma.propertyRiskScore.findUnique({ where: { propertyId } })
    if (risk?.level === 'HIGH' || risk?.level === 'SUSPICIOUS') {
      await prisma.property.update({ where: { id: propertyId }, data: { status: 'SUSPENDED' } })
    }
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } })
  if (property && !data.isAnonymous) {
    await notifyUser(property.ownerId, { type: 'REPORT_SUBMITTED', title: 'A concern was raised about your property', body: 'A user has reported a concern. Our team will review it.', referenceId: report.id, referenceType: 'PropertyReport' })
  }

  return report
}

export async function adminListReports({ status, severity, category, page = 1, limit = 20 }) {
  const where = {}
  if (status) where.status = status
  if (severity) where.severity = severity
  if (category) where.category = category
  const skip = (page - 1) * limit
  const [reports, total] = await Promise.all([
    prisma.propertyReport.findMany({
      where, skip, take: limit,
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: { property: { select: { id: true, title: true, city: true } }, moderationAction: true },
    }),
    prisma.propertyReport.count({ where }),
  ])
  return { reports, total, page, limit }
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
    await prisma.property.update({ where: { id: report.propertyId }, data: { status: 'SUSPENDED' } })
  }
  if (action === 'DISMISS' || action === 'REJECT') {
    await recalculateRiskScore(report.propertyId)
  }
  if (action === 'WARN_OWNER') {
    const property = await prisma.property.findUnique({ where: { id: report.propertyId }, select: { ownerId: true } })
    if (property) {
      await notifyUser(property.ownerId, { type: 'ADMIN_WARNING', title: 'Admin Warning', body: note || 'You have received a warning from the admin regarding your property.', referenceId: reportId, referenceType: 'PropertyReport' })
    }
  }

  return updatedReport
}
