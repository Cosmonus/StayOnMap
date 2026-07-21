import { prisma } from '../../lib/prisma.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { sendEmail, adminPasswordChangedEmail } from '../../services/email.service.js'
import { ADMIN_FILTERS, buildFilterWhere } from '../properties/filters.registry.js'
import { parseBounds, boundsFilter } from '../../utils/geo.js'
import { getContext, STATUS_FAILED } from '../spatial/spatial.service.js'
import { intelError } from '../../lib/intelLog.js'

export async function adminLogin(email, password) {
  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: 'ADMIN' },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  )
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name } }
}

export async function getDashboardAnalytics() {
  const cached = await cacheGet('admin:analytics')
  if (cached) return cached

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    totalUsers, newUsersToday, newUsersThisWeek,
    totalProperties, activeProperties, pendingProperties, suspendedProperties,
    totalReports, openReports, criticalReports,
    totalAppointments, pendingAppointments,
    verificationsPending,
    highRiskProperties, suspiciousProperties,
    monthlyUsersRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.property.count(),
    prisma.property.count({ where: { status: 'ACTIVE' } }),
    prisma.property.count({ where: { status: 'PENDING' } }),
    prisma.property.count({ where: { status: 'SUSPENDED' } }),
    prisma.propertyReport.count(),
    prisma.propertyReport.count({ where: { status: 'PENDING' } }),
    prisma.propertyReport.count({ where: { severity: 'CRITICAL', status: 'PENDING' } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    prisma.ownershipVerification.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.propertyRiskScore.count({ where: { level: 'HIGH' } }),
    prisma.propertyRiskScore.count({ where: { level: 'SUSPICIOUS' } }),
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
        CAST(COUNT(*) AS INTEGER)                             AS count
      FROM "User"
      WHERE "createdAt" >= ${twelveMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
  ])

  // Convert to plain objects (raw queries can return BigInt on some drivers)
  const monthly = monthlyUsersRaw.map(r => ({ month: r.month, count: Number(r.count) }))

  const result = {
    users: { total: totalUsers, newToday: newUsersToday, newThisWeek: newUsersThisWeek, monthly },
    properties: { total: totalProperties, active: activeProperties, pending: pendingProperties, suspended: suspendedProperties },
    reports: { total: totalReports, open: openReports, critical: criticalReports },
    appointments: { total: totalAppointments, pending: pendingAppointments },
    verificationsPending,
    risk: { highRisk: highRiskProperties, suspicious: suspiciousProperties },
  }
  await cacheSet('admin:analytics', result, 60)
  return result
}

export async function listWaitlist({ page = 1, limit = 20 }) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 20)
  const skip = (pageNum - 1) * limitNum
  const [entries, total] = await Promise.all([
    prisma.waitlistEntry.findMany({ skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
    prisma.waitlistEntry.count(),
  ])
  return { entries, total, page: pageNum, limit: limitNum }
}

export async function listUsers({ search, isBlocked, page = 1, limit = 20 }) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 20)
  const where = {}
  if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }]
  if (isBlocked !== undefined) where.isBlocked = isBlocked === 'true'
  const skip = (pageNum - 1) * limitNum
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' }, select: { id: true, displayId: true, email: true, name: true, phone: true, role: true, city: true, isBusiness: true, isVerified: true, isBlocked: true, createdAt: true, _count: { select: { properties: true, appointments: true, reports: true } } } }),
    prisma.user.count({ where }),
  ])
  return { users, total, page: pageNum, limit: limitNum }
}

export async function getUserDetail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { properties: { select: { id: true, title: true, status: true, city: true } }, appointments: { take: 5, orderBy: { createdAt: 'desc' } }, reports: { take: 5, orderBy: { createdAt: 'desc' } } },
  })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  return user
}

export async function toggleUserBlock(userId, blocked, reason, adminId) {
  const user = await prisma.user.update({ where: { id: userId }, data: { isBlocked: blocked } })
  if (blocked) {
    await prisma.property.updateMany({ where: { ownerId: userId, status: 'ACTIVE' }, data: { status: 'SUSPENDED' } })
  }
  await prisma.activityLog.create({ data: { adminId, action: blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', entity: 'User', entityId: userId, meta: { reason } } })
  return user
}

// Same filter engine as the public map (features/properties/filters.registry.js),
// plus the admin-only status/riskLevel — so the two surfaces can't drift again.
// This used to be a hand-written if-chain that reimplemented city/type/bhk and
// supported nothing else; the duplicated bhk branch also assigned a top-level
// `where.OR`, which any other top-level OR would have silently clobbered.
//
// Deliberately NOT shared with the user path:
//   - no `status: 'ACTIVE'` default — seeing DRAFT/PENDING/SUSPENDED is the job
//   - no applyVisibilityFilter — admins must see HIDDEN owners' listings
//   - no Redis cache — moderation needs read-after-write freshness
//   - take: 500 (vs the user map's 200)
export async function getAdminPins(query = {}) {
  const bounds = parseBounds(query)
  const hasBounds = Object.values(bounds).every(Number.isFinite)

  const where = { ...(hasBounds ? boundsFilter(bounds) : {}) }
  const fragments = buildFilterWhere(query, ADMIN_FILTERS)
  if (fragments.length) where.AND = fragments

  return prisma.property.findMany({
    where,
    select: { id: true, lat: true, lng: true, rent: true, type: true, status: true, bhk: true, trustScore: { select: { badge: true } } },
    take: 500,
  })
}

export async function getAdminPropertyById(id) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      images: { select: { url: true, isPrimary: true, order: true }, orderBy: { order: 'asc' } },
      owner: { select: { id: true, displayId: true, name: true, email: true, phone: true, avatarUrl: true, isVerified: true, isBusiness: true } },
      trustScore: true,
      riskScore: true,
      amenities: { select: { amenity: { select: { id: true, name: true } } } },
      rules: true,
      appointments: {
        select: {
          id: true, status: true, requestedDate: true, requestedTime: true,
          message: true, ownerNote: true, contactNumber: true, tenantId: true,
          tenant: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      savedBy: {
        select: { userId: true, createdAt: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      conversations: {
        select: {
          id: true, tenantId: true, lastMessageAt: true,
          tenant: { select: { id: true, name: true, email: true, avatarUrl: true } },
          messages: {
            select: { id: true, senderId: true, body: true, attachmentUrl: true, editedAt: true, deletedAt: true, createdAt: true, sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        // Bounded like the messages above — without it this include grows with
        // chat volume until the response OOMs. 50 most-recent threads is more
        // than the moderation view renders; _count still carries the true total.
        take: 50,
      },
      reports: {
        select: {
          id: true, reporterId: true, category: true, description: true, severity: true, status: true, isAnonymous: true, createdAt: true,
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { reports: true, appointments: true, savedBy: true, conversations: true } },
    },
  })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })

  // Same spatial join as the public getPropertyById (properties.service.js) —
  // the admin detail view renders the identical SpatialContextPanel, and a
  // moderator judging a listing needs the same area facts a renter sees.
  // A MISS may schedule computation, exactly like the public path. A failure
  // must not read as "this neighbourhood has nothing" — say which it was.
  property.spatialContext = await getContext(
    Number(property.lat), Number(property.lng),
    { waitMs: 3000, propertyType: property.type }
  ).catch((err) => {
    intelError('spatial.context_failed', err, { propertyId: property.id })
    return { modules: null, pending: false, status: STATUS_FAILED }
  })

  return property
}

// Same registry as getAdminPins, so the table and the map agree on what a
// filter means. `riskLevel` was previously accepted and silently dropped
// (a dead `_riskLevel` param) — it now actually filters.
export async function listAdminProperties({ page = 1, limit = 20, ...query } = {}) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 20)
  const where = {}
  const fragments = buildFilterWhere(query, ADMIN_FILTERS)
  if (fragments.length) where.AND = fragments
  const skip = (pageNum - 1) * limitNum
  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where, skip, take: limitNum, orderBy: { createdAt: 'desc' },
      include: {
        images: { select: { url: true, isPrimary: true, order: true }, orderBy: { order: 'asc' } },
        owner: { select: { id: true, displayId: true, name: true, email: true, phone: true, avatarUrl: true, isVerified: true, isBusiness: true } },
        trustScore: true,
        riskScore: true,
        amenities: { select: { amenity: { select: { id: true, name: true } } } },
        rules: true,
        appointments: {
          select: {
            id: true, status: true, requestedDate: true, requestedTime: true,
            message: true, ownerNote: true, contactNumber: true,
            tenantId: true,
            tenant: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        savedBy: {
          select: { userId: true, createdAt: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        // conversations deliberately NOT included — the list renders summaries
        // and _count; chat threads come from getAdminPropertyById when a row is
        // opened. The old unbounded include (every thread × 50 messages × 20
        // rows per page) degraded from slow to OOM purely as chat volume grew.
        reports: {
          select: {
            id: true, reporterId: true, category: true, description: true, severity: true, status: true, isAnonymous: true, createdAt: true,
            reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { reports: true, appointments: true, savedBy: true, conversations: true } },
      },
    }),
    prisma.property.count({ where }),
  ])
  return { properties, total, page: pageNum, limit: limitNum }
}

export async function setPropertyStatus(propertyId, status, note, adminId) {
  const property = await prisma.property.update({ where: { id: propertyId }, data: { status } })
  await prisma.activityLog.create({ data: { adminId, action: 'PROPERTY_STATUS_CHANGED', entity: 'Property', entityId: propertyId, meta: { status, note } } })
  return property
}

export async function getModerationQueue() {
  const [criticalReports, pendingVerifications, highRiskProps] = await Promise.all([
    prisma.propertyReport.findMany({ where: { status: 'PENDING' }, include: { property: { select: { id: true, title: true, city: true } } }, orderBy: { severity: 'asc' }, take: 20 }),
    prisma.ownershipVerification.findMany({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } }, include: { property: { select: { id: true, title: true, city: true } }, documents: true }, take: 20 }),
    prisma.propertyRiskScore.findMany({ where: { level: { in: ['HIGH', 'SUSPICIOUS'] } }, include: { property: { select: { id: true, title: true, city: true, status: true } } }, orderBy: { score: 'desc' }, take: 20 }),
  ])
  return { criticalReports, pendingVerifications, highRiskProps }
}

export async function listActivityLogs({ userId, action, page = 1, limit = 50 }) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 50)
  const where = {}
  if (userId) where.userId = userId
  if (action) where.action = { contains: action, mode: 'insensitive' }
  const skip = (pageNum - 1) * limitNum
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } }),
    prisma.activityLog.count({ where }),
  ])
  return { logs, total, page: pageNum, limit: limitNum }
}

export async function listAmenities() {
  return prisma.amenity.findMany({ orderBy: { name: 'asc' } })
}

export async function createAmenity(name) {
  return prisma.amenity.create({ data: { name } })
}

export async function deleteAmenity(id) {
  const used = await prisma.propertyAmenity.count({ where: { amenityId: id } })
  if (used > 0) throw Object.assign(new Error('Amenity is in use by properties'), { statusCode: 409 })
  return prisma.amenity.delete({ where: { id } })
}

const RATING_KEYS = [
  'ratingsSafety', 'ratingsClean', 'ratingsWater', 'ratingsNoise',
  'ratingsInternet', 'ratingsParking', 'ratingsNeighborhood', 'ratingsTransport',
  'ratingsMaintenance', 'ratingsOwnerBehavior', 'ratingsSecurity', 'ratingsPowerBackup',
]

function reviewOverallScore(r) {
  return RATING_KEYS.reduce((s, k) => s + (r[k] ?? 0), 0) / RATING_KEYS.length
}

export async function listReviews({ status, propertyId, page = 1, limit = 30 }) {
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
  const limitNum = Math.min(100, parseInt(limit, 10) || 30)
  const where = {}
  if (status) where.status = status
  if (propertyId) where.propertyId = propertyId
  const skip = (pageNum - 1) * limitNum
  const [rows, total] = await Promise.all([
    prisma.communityReview.findMany({
      where, skip, take: limitNum, orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        property: { select: { id: true, title: true, city: true } },
      },
    }),
    prisma.communityReview.count({ where }),
  ])
  const reviews = rows.map(r => ({
    ...r,
    content: r.body,
    overallScore: parseFloat(reviewOverallScore(r).toFixed(1)),
    author: r.isAnonymous ? null : r.reviewer,
  }))
  return { reviews, total, page: pageNum, limit: limitNum }
}

export async function getMonitorStatus() {
  const [
    propertyByStatus,
    userByRole,
    blockedUsers,
    appointmentByStatus,
    recentActivity,
    pendingModerationRaw,
    dbStatus,
  ] = await Promise.all([
    prisma.property.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { isBlocked: true } }),
    prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.activityLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { name: true } } },
    }),
    Promise.all([
      prisma.property.count({ where: { status: 'PENDING' } }),
      prisma.propertyReport.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
      prisma.communityReview.count({ where: { status: 'PENDING' } }),
      prisma.ownershipVerification.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    ]),
    prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'error'),
  ])

  const [pendingProperties, pendingReports, pendingReviews, pendingVerifications] = pendingModerationRaw

  return {
    propertyByStatus: propertyByStatus.map(r => ({ status: r.status, count: r._count._all })),
    userByRole:       userByRole.map(r => ({ role: r.role, count: r._count._all })),
    blockedUsers,
    appointmentByStatus: appointmentByStatus.map(r => ({ status: r.status, count: r._count._all })),
    recentActivity,
    pendingModeration: {
      properties:    pendingProperties,
      reports:       pendingReports,
      reviews:       pendingReviews,
      verifications: pendingVerifications,
    },
    dbStatus,
    system: {
      aiProvider:   process.env.AI_PROVIDER ?? 'stub',
      redisEnabled: !!process.env.REDIS_URL,
      emailEnabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      pushEnabled:  !!process.env.VAPID_PUBLIC_KEY,
      nodeEnv:      process.env.NODE_ENV ?? 'development',
      selfUrl:      process.env.SELF_URL ?? null,
    },
    timestamp: new Date().toISOString(),
  }
}

export async function getAdminProfile(adminId) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { id: true, email: true, name: true, createdAt: true } })
  if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 })
  return admin
}

export async function updateAdminProfile(adminId, { name, email }) {
  if (email) {
    const existing = await prisma.admin.findFirst({ where: { email, id: { not: adminId } } })
    if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 })
  }
  return prisma.admin.update({
    where: { id: adminId },
    data: { ...(name && { name }), ...(email && { email }) },
    select: { id: true, email: true, name: true, createdAt: true },
  })
}

export async function changeAdminPassword(adminId, currentPassword, newPassword) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } })
  if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 })
  const valid = await bcrypt.compare(currentPassword, admin.passwordHash)
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 })
  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.admin.update({ where: { id: adminId }, data: { passwordHash: hash } })
  sendEmail({ to: admin.email, ...adminPasswordChangedEmail({ adminName: admin.name, adminEmail: admin.email }), critical: true })
}

export async function moderateReview(reviewId, status, adminId) {
  const allowed = ['APPROVED', 'REJECTED', 'FLAGGED']
  if (!allowed.includes(status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 })
  const review = await prisma.communityReview.update({ where: { id: reviewId }, data: { status } })
  await prisma.activityLog.create({
    data: { adminId, action: 'REVIEW_MODERATED', entity: 'CommunityReview', entityId: reviewId, meta: { status } },
  })
  if (status === 'APPROVED') {
    const { recalculateTrustScore } = await import('../trust/trust.service.js')
    await recalculateTrustScore(review.propertyId).catch(() => {})
    // Points on APPROVAL, never on submit — otherwise writing junk reviews pays.
    // Idempotent by (userId, action, reviewId), so re-approving doesn't re-pay.
    const { awardPoints } = await import('../points/points.service.js')
    awardPoints(review.authorId, 'REVIEW_APPROVED', reviewId).catch(() => {})
  }
  return review
}
