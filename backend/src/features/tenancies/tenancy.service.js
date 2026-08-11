import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { isRevealed, canReview } from './reveal.js'

// The tenancy record and the double-blind reviews over it. The record-WRITING
// halves (start/end) are exported as Prisma operation builders so the four
// call sites — markTenant, vacate, sign, terminate — can put them INSIDE their
// own transactions: a tenancy that silently failed to write while the listing
// flipped OCCUPIED would be the old evidence-destroying behaviour back under a
// new name.

/** The tenancy row markTenant creates — UNCONFIRMED, an owner's assertion. */
export function startMarkedTenancyOp({ propertyId, ownerId, tenantId }) {
  return prisma.tenancy.create({
    data: { propertyId, ownerId, tenantId, source: 'MARKED', startedAt: new Date() },
  })
}

/** The tenancy row a signed lease creates — CONFIRMED, signing IS agreement. */
export function startLeaseTenancyOp(lease) {
  return prisma.tenancy.create({
    data: {
      propertyId: lease.propertyId,
      ownerId: lease.ownerId,
      tenantId: lease.tenantId,
      source: 'LEASE',
      leaseId: lease.id,
      startedAt: lease.startDate,
      confirmedAt: new Date(),
    },
  })
}

/** Ends every ongoing tenancy on a property (vacate) or one lease's (terminate). */
export function endTenancyOp(where) {
  return prisma.tenancy.updateMany({
    where: { ...where, endedAt: null },
    data: { endedAt: new Date() },
  })
}

/** Ask the tenant to confirm — fire-and-forget at the call site. */
export async function notifyTenancyCreated(tenancy) {
  const property = await prisma.property.findUnique({
    where: { id: tenancy.propertyId }, select: { title: true },
  })
  await notifyUser(tenancy.tenantId, {
    type: 'TENANCY_UPDATE',
    audience: 'TENANT',
    title: 'Are you renting this home?',
    body: `The owner of ${property?.title ?? 'a listing'} marked you as their tenant. Confirm it to build your rental history.`,
    referenceId: tenancy.id,
    referenceType: 'Tenancy',
  })
}

// ── The tenant's word ────────────────────────────────────────────────────────

export async function confirmTenancy(tenancyId, userId) {
  // Scoped by tenantId in the where — only the person the assertion is ABOUT
  // can turn it into history. 404 for anyone else, never 403.
  const { count } = await prisma.tenancy.updateMany({
    where: { id: tenancyId, tenantId: userId, confirmedAt: null },
    data: { confirmedAt: new Date() },
  })
  if (!count) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  const t = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: { property: { select: { title: true } } },
  })
  notifyUser(t.ownerId, {
    type: 'TENANCY_UPDATE',
    audience: 'OWNER',
    title: 'Tenancy confirmed',
    body: `Your tenant confirmed the tenancy at ${t.property.title}.`,
    referenceId: t.id,
    referenceType: 'Tenancy',
  }).catch(() => {})
  return t
}

export async function declineTenancy(tenancyId, userId) {
  // Declining DELETES the row: a record the tenant says is false must not sit
  // in the database as "unconfirmed", because unconfirmed still names them.
  const t = await prisma.tenancy.findFirst({
    where: { id: tenancyId, tenantId: userId, confirmedAt: null },
    include: { property: { select: { title: true } } },
  })
  if (!t) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  await prisma.tenancy.delete({ where: { id: t.id } })
  notifyUser(t.ownerId, {
    type: 'TENANCY_UPDATE',
    audience: 'OWNER',
    title: 'Tenancy declined',
    body: `The person you marked as tenant at ${t.property.title} says that isn't right. The record was removed.`,
    referenceId: t.propertyId,
    referenceType: 'Property',
  }).catch(() => {})
}

// ── Reading ──────────────────────────────────────────────────────────────────

const TENANCY_INCLUDE = {
  property: { select: { id: true, title: true, city: true, type: true } },
  reviews: true,
}

/**
 * The caller's tenancies for one hat, with reviews filtered by the reveal
 * rule: your own review always; the other side's only when revealed.
 */
export async function listMyTenancies(userId, hat) {
  const where = hat === 'owner' ? { ownerId: userId } : { tenantId: userId }
  const rows = await prisma.tenancy.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    include: TENANCY_INCLUDE,
  })
  return rows.map((t) => shapeForParty(t, userId))
}

function shapeForParty(t, viewerId) {
  const mine = t.reviews.find((r) => r.authorId === viewerId) ?? null
  const theirsRaw = t.reviews.find((r) => r.authorId !== viewerId) ?? null
  const theirs = theirsRaw && isRevealed(theirsRaw, mine) ? theirsRaw : null
  const gate = canReview(t, viewerId)
  return {
    id: t.id,
    property: t.property,
    source: t.source,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    confirmedAt: t.confirmedAt,
    // What the viewer may DO, decided server-side so two clients cannot
    // disagree with the API about when a form should render.
    canReview: gate.ok && !mine,
    reviewBlockedReason: gate.ok || mine ? null : gate.reason,
    myReview: mine,
    // `theirReviewPending` says one exists without showing it — the honest
    // middle: hiding its existence would make the reveal feel like an ambush,
    // showing its text would break the blind.
    theirReview: theirs,
    theirReviewPending: !!theirsRaw && !theirs,
  }
}

// ── Writing a review ─────────────────────────────────────────────────────────

export async function addReview(tenancyId, authorId, { rating, content }) {
  const tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId } })
  // Party check FIRST and as a 404: a tenancy id must not be a way to learn a
  // tenancy exists (the support-case rule).
  if (!tenancy || (tenancy.ownerId !== authorId && tenancy.tenantId !== authorId)) {
    throw Object.assign(new Error('Not found'), { statusCode: 404 })
  }
  const gate = canReview(tenancy, authorId)
  if (!gate.ok) throw Object.assign(new Error(gate.reason), { statusCode: 400 })

  const targetId = authorId === tenancy.ownerId ? tenancy.tenantId : tenancy.ownerId
  let review
  try {
    review = await prisma.tenancyReview.create({
      data: { tenancyId, authorId, targetId, rating, content },
    })
  } catch (err) {
    if (err?.code === 'P2002') {
      throw Object.assign(new Error('You have already reviewed this tenancy'), { statusCode: 409 })
    }
    throw err
  }

  const counterpart = await prisma.tenancyReview.findFirst({
    where: { tenancyId, authorId: targetId },
  })
  const audienceOf = (userId) => (userId === tenancy.ownerId ? 'OWNER' : 'TENANT')
  if (counterpart) {
    // Both are in — the blind lifts NOW, tell both sides.
    for (const userId of [authorId, targetId]) {
      notifyUser(userId, {
        type: 'TENANCY_UPDATE',
        audience: audienceOf(userId),
        title: 'Your tenancy reviews are visible',
        body: 'Both of you have written your reviews — they are now visible to each other.',
        referenceId: tenancyId,
        referenceType: 'Tenancy',
      }).catch(() => {})
    }
  } else {
    // Say one EXISTS without showing it — the incentive that makes
    // double-blind converge instead of stalling.
    notifyUser(targetId, {
      type: 'TENANCY_UPDATE',
      audience: audienceOf(targetId),
      title: 'You have a tenancy review waiting',
      body: 'Write yours to see it — otherwise it becomes visible in 14 days.',
      referenceId: tenancyId,
      referenceType: 'Tenancy',
    }).catch(() => {})
  }
  return review
}

// ── The rental résumé ────────────────────────────────────────────────────────

/**
 * A tenant's history, shown to an OWNER they have contacted. Not public: a
 * person's housing history is sensitive, and the résumé exists to answer "who
 * is asking about my listing", not to make anyone's past googleable.
 */
export async function tenantResume(ownerId, tenantUserId) {
  // The contact guard — the same sets the mark-tenant picker trusts:
  // a conversation or a visit request between these two people.
  const [chatted, visited] = await Promise.all([
    prisma.conversation.count({ where: { ownerId, tenantId: tenantUserId } }),
    prisma.appointment.count({ where: { ownerId, tenantId: tenantUserId } }),
  ])
  // 404, never 403: "you may not see this person" and "this person does not
  // exist" must be the same answer, or the endpoint enumerates users.
  if (chatted + visited === 0) throw Object.assign(new Error('Not found'), { statusCode: 404 })

  const tenancies = await prisma.tenancy.findMany({
    where: { tenantId: tenantUserId, confirmedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    include: {
      property: { select: { city: true, type: true } },
      reviews: true,
    },
  })

  const entries = tenancies.map((t) => {
    const aboutTenant = t.reviews.find((r) => r.targetId === tenantUserId) ?? null
    const byTenant = t.reviews.find((r) => r.authorId === tenantUserId) ?? null
    const revealed = aboutTenant && isRevealed(aboutTenant, byTenant) ? aboutTenant : null
    return {
      // City and type, never the address or title — the résumé says how this
      // person rents, not where to find their previous home.
      city: t.property.city,
      propertyType: t.property.type,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      review: revealed ? { rating: revealed.rating, content: revealed.content, createdAt: revealed.createdAt } : null,
    }
  })

  const rated = entries.filter((e) => e.review)
  return {
    tenancies: entries,
    count: entries.length,
    averageRating: rated.length
      ? Math.round((rated.reduce((s, e) => s + e.review.rating, 0) / rated.length) * 10) / 10
      : null,
  }
}

/**
 * Revealed tenant-on-owner reviews for a LISTING's owner — the public half.
 * The owner id is resolved server-side and never returned (public property
 * payloads must not carry ownerId — .claude/security.md).
 */
export async function ownerReviewsForProperty(propertyId) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }, select: { ownerId: true },
  })
  if (!property) throw Object.assign(new Error('Not found'), { statusCode: 404 })

  const tenancies = await prisma.tenancy.findMany({
    where: { ownerId: property.ownerId, confirmedAt: { not: null }, reviews: { some: {} } },
    orderBy: { startedAt: 'desc' },
    take: 20,
    include: {
      property: { select: { city: true, type: true } },
      reviews: true,
      tenant: { select: { name: true } },
    },
  })

  const reviews = []
  for (const t of tenancies) {
    const byTenant = t.reviews.find((r) => r.authorId === t.tenantId)
    if (!byTenant) continue
    const byOwner = t.reviews.find((r) => r.authorId === t.ownerId) ?? null
    if (!isRevealed(byTenant, byOwner)) continue
    reviews.push({
      // First name only — enough to be human, not enough to be hunted.
      reviewerFirstName: (t.tenant.name ?? '').split(' ')[0] || 'A renter',
      city: t.property.city,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      rating: byTenant.rating,
      content: byTenant.content,
      createdAt: byTenant.createdAt,
    })
  }
  return reviews
}
