import { prisma } from '../../lib/prisma.js'

// The host dashboard: what needs the owner TODAY, and what the last 30 days
// actually did.
//
// The ordering principle is that an owner opens this page with one question —
// "is anyone waiting on me?" — and every other number is secondary. So the
// action queue is computed first and the stats are framed as a period, never as
// a lifetime total dressed up as recent activity.

const WINDOW_DAYS = 30

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

// The 12 category ratings averaged into the one number a review is worth
// summarising as ("left you 4 stars"). Same shape trust.service.js uses.
const RATING_FIELDS = [
  'ratingsSafety', 'ratingsClean', 'ratingsWater', 'ratingsNoise',
  'ratingsInternet', 'ratingsParking', 'ratingsNeighborhood', 'ratingsTransport',
  'ratingsMaintenance', 'ratingsOwnerBehavior', 'ratingsSecurity', 'ratingsPowerBackup',
]

function averageRating(review) {
  const values = RATING_FIELDS.map((f) => review[f]).filter((v) => typeof v === 'number')
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

// "2 BHK Koramangala" — how an owner refers to their own listing.
function listingLabel(property) {
  if (!property) return ''
  const size = property.bhk ? `${property.bhk} BHK`
    : property.sharing ? `${property.sharing}-sharing`
    : null
  return [size, property.landmark || property.city].filter(Boolean).join(' ')
}

// Everything waiting on the owner, newest question first. Two kinds today:
// a visit nobody has answered, and a review nobody has replied to.
async function needsYouToday(ownerId) {
  const [visits, reviews] = await Promise.all([
    prisma.appointment.findMany({
      // RESCHEDULE_REQUESTED belongs here too: a renter's counter-offer is
      // waiting on exactly the same yes-or-no as a first request, and leaving
      // it out would have parked it in the queue the dashboard exists to empty.
      where: { ownerId, status: { in: ['PENDING', 'RESCHEDULE_REQUESTED'] } },
      include: {
        tenant: { select: { id: true, name: true, email: true, avatarUrl: true } },
        property: { select: { id: true, title: true, bhk: true, sharing: true, landmark: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.communityReview.findMany({
      where: {
        status: 'APPROVED',
        ownerResponse: null,
        property: { ownerId },
      },
      include: { property: { select: { id: true, title: true, bhk: true, sharing: true, landmark: true, city: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  // How many times this exact person has looked at this exact listing. Read
  // ONLY here — beside their own visit request, which is where they identified
  // themselves to the owner. See PropertyViewer in schema.prisma.
  const viewerCounts = visits.length
    ? await prisma.propertyViewer.findMany({
      where: {
        propertyId: { in: [...new Set(visits.map((v) => v.propertyId))] },
        userId: { in: [...new Set(visits.map((v) => v.tenantId))] },
      },
      select: { propertyId: true, userId: true, count: true },
    })
    : []
  const viewsByPair = new Map(viewerCounts.map((v) => [`${v.propertyId}:${v.userId}`, v.count]))

  const visitItems = visits.map((v) => ({
    kind: 'VISIT_REQUEST',
    id: v.id,
    propertyId: v.propertyId,
    listing: listingLabel(v.property),
    person: v.tenant?.name || v.tenant?.email?.split('@')[0] || 'Someone',
    requestedDate: v.requestedDate,
    requestedTime: v.requestedTime,
    askedAt: v.createdAt,
    message: v.message,
    // null (not 0) when we have no record — "viewed it 0 times" would be a
    // claim, and someone can request a visit from a map pin without ever
    // opening the listing.
    viewerViews: viewsByPair.get(`${v.propertyId}:${v.tenantId}`) ?? null,
  }))

  const reviewItems = reviews.map((r) => ({
    kind: 'REVIEW',
    id: r.id,
    propertyId: r.propertyId,
    listing: listingLabel(r.property),
    rating: averageRating(r),
    quote: r.body,
    askedAt: r.createdAt,
  }))

  return [...visitItems, ...reviewItems].sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt))
}

// The last 30 days, each number next to the thing that makes it readable.
// Views and saves are compared with the previous 30 days, because "18 saves" on
// its own says nothing about whether that is good.
async function lastThirtyDays(ownerId, propertyIds) {
  if (propertyIds.length === 0) {
    return { views: 0, viewsPrev: 0, saves: 0, savesPrev: 0, visitRequests: 0, visitsAccepted: 0, signedLeases: 0, signedLeaseListing: null, listingCount: 0 }
  }

  const since = daysAgo(WINDOW_DAYS)
  const prevSince = daysAgo(WINDOW_DAYS * 2)

  const [views, viewsPrev, saves, savesPrev, visitRequests, visitsAccepted, leases] = await Promise.all([
    prisma.propertyDailyView.aggregate({
      where: { propertyId: { in: propertyIds }, day: { gte: since } },
      _sum: { count: true },
    }),
    prisma.propertyDailyView.aggregate({
      where: { propertyId: { in: propertyIds }, day: { gte: prevSince, lt: since } },
      _sum: { count: true },
    }),
    prisma.savedListing.count({ where: { propertyId: { in: propertyIds }, createdAt: { gte: since } } }),
    prisma.savedListing.count({ where: { propertyId: { in: propertyIds }, createdAt: { gte: prevSince, lt: since } } }),
    prisma.appointment.count({ where: { ownerId, createdAt: { gte: since } } }),
    prisma.appointment.count({ where: { ownerId, createdAt: { gte: since }, status: 'ACCEPTED' } }),
    prisma.lease.findMany({
      where: { ownerId, signedAt: { gte: since } },
      include: { property: { select: { bhk: true, sharing: true, landmark: true, city: true } } },
      orderBy: { signedAt: 'desc' },
    }),
  ])

  return {
    views: views._sum.count ?? 0,
    viewsPrev: viewsPrev._sum.count ?? 0,
    saves,
    savesPrev,
    visitRequests,
    visitsAccepted,
    signedLeases: leases.length,
    // Named, because "1 signed lease" without saying which one sends the owner
    // hunting through their listings.
    signedLeaseListing: leases[0] ? listingLabel(leases[0].property) : null,
    listingCount: propertyIds.length,
  }
}

export async function getHostDashboard(ownerId) {
  const listings = await prisma.property.findMany({
    where: { ownerId, status: { in: ['ACTIVE', 'OCCUPIED'] } },
    select: { id: true },
  })
  const propertyIds = listings.map((p) => p.id)

  const [queue, stats] = await Promise.all([
    needsYouToday(ownerId),
    lastThirtyDays(ownerId, propertyIds),
  ])

  return { needsYouToday: queue, last30Days: { ...stats, windowDays: WINDOW_DAYS } }
}
