import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { boundsFilter } from '../../utils/geo.js'
import { buildFilterWhere } from '../properties/filters.registry.js'
import { notifyUser } from '../notifications/notifications.service.js'

// Ten is not a product decision, it is a matcher bound: every saved search is
// one indexed query per newly-published listing, so the cap is what keeps
// "publish a listing" O(searches) with a known ceiling. Nobody maintains ten
// distinct home searches; somebody farming rows might.
const MAX_PER_USER = 10

// A hard stop for the matcher as a whole, far above anything real at current
// scale — the same backstop reasoning as the graph layer's MAX_ROWS.
const MAX_SEARCHES_PER_MATCH = 500

export async function listSavedSearches(userId) {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, query: true, createdAt: true },
  })
}

export async function createSavedSearch(userId, { name, query }) {
  const count = await prisma.savedSearch.count({ where: { userId } })
  if (count >= MAX_PER_USER) {
    throw Object.assign(new Error(`You can keep up to ${MAX_PER_USER} saved searches — delete one first`), {
      statusCode: 400,
    })
  }
  return prisma.savedSearch.create({
    data: { userId, name, query },
    select: { id: true, name: true, query: true, createdAt: true },
  })
}

export async function deleteSavedSearch(userId, id) {
  try {
    // Ownership via the compound where — the same pattern as every other
    // owner-scoped delete; a stranger's id answers 404, not 403.
    await prisma.savedSearch.delete({ where: { id, userId } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw Object.assign(new Error('Not found'), { statusCode: 404 })
    }
    throw err
  }
}

/** The Prisma where that asks "does this ONE property satisfy this search". */
export function whereForSearch(propertyId, query) {
  const hasBounds = [query.swLat, query.swLng, query.neLat, query.neLng]
    .every((v) => v !== undefined && v !== null)
  return {
    id: propertyId,
    status: 'ACTIVE',
    // Same non-negotiables as the public read path: a saved rent search must
    // not match a lease lump sum, and vice versa.
    pricingModel: query.pricingModel ?? 'RENT',
    AND: buildFilterWhere(query),
    ...(hasBounds ? boundsFilter(query) : {}),
  }
}

/**
 * A listing just became visible for the FIRST time — tell everyone whose
 * saved search it satisfies.
 *
 * Called fire-and-forget from the two doors where firstPublishStamp() stamps
 * (admin approval, verification approval). Deliberately NOT called from
 * vacate or from edits: `.catch(() => {})` at the call sites, because a
 * notification must never break the moderation write that earned it — the
 * same rule every notifyUser caller follows.
 *
 * One indexed count per saved search, scoped to the single property id. Not a
 * scan: with the per-user cap this is bounded, and each query is a primary-key
 * lookup narrowed by the filter fragments.
 */
export async function matchNewSupply(propertyId) {
  const searches = await prisma.savedSearch.findMany({
    take: MAX_SEARCHES_PER_MATCH,
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, name: true, query: true },
  })
  if (!searches.length) return 0

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { ownerId: true, title: true, city: true },
  })
  if (!property) return 0

  let notified = 0
  for (const search of searches) {
    // Your own listing matching your own search is not news.
    if (search.userId === property.ownerId) continue
    const hit = await prisma.property.count({ where: whereForSearch(propertyId, search.query) })
    if (!hit) continue
    await notifyUser(search.userId, {
      type: 'SAVED_SEARCH_MATCH',
      // Renter-facing by definition — a saved search is a renter's hat even
      // on an account that also hosts.
      audience: 'TENANT',
      title: 'New home matches your search',
      body: `${property.title} in ${property.city} matches “${search.name}”`,
      referenceId: propertyId,
      referenceType: 'Property',
    })
    notified++
  }
  return notified
}
