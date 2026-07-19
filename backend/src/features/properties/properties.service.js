import { prisma } from '../../lib/prisma.js'
import { boundsFilter } from '../../utils/geo.js'
import { recalculateTrustScore } from '../trust/trust.service.js'
import { evaluateListing, getRentBenchmark } from '../../services/intelligence.service.js'
import { getContext, ensureContextForProperty, STATUS_FAILED } from '../spatial/spatial.service.js'
import { generatePropertyDisplayId } from '../../utils/idGenerator.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { buildFilterWhere, filterCacheKey } from './filters.registry.js'

const FULL_INCLUDE = {
  images:    { orderBy: { order: 'asc' } },
  amenities: { include: { amenity: true } },
  rules:     true,
  trustScore: true,
  riskScore:  true,
  owner:         { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
  currentTenant: { select: { id: true, name: true, avatarUrl: true } },
}

export async function listProperties(filters, { skip, limit }, userId = null) {
  const where = buildWhereClause(filters)
  applyVisibilityFilter(where, userId)
  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { images: { where: { isPrimary: true }, take: 1 }, trustScore: true, riskScore: true } }),
    prisma.property.count({ where }),
  ])
  return { properties, total }
}

export async function getPinsInBounds(bounds, filters, userId = null) {
  // Round bbox to 2 dp (~1km grid) so nearby pans share the same cache bucket
  const roundedBounds = bounds ? {
    swLat: bounds.swLat != null ? Math.floor(Number(bounds.swLat) * 100) / 100 : null,
    swLng: bounds.swLng != null ? Math.floor(Number(bounds.swLng) * 100) / 100 : null,
    neLat: bounds.neLat != null ? Math.ceil(Number(bounds.neLat)  * 100) / 100 : null,
    neLng: bounds.neLng != null ? Math.ceil(Number(bounds.neLng)  * 100) / 100 : null,
  } : {}
  // auth included: applyVisibilityFilter() below shows LOGGED_IN-only listings
  // to authenticated users — without this, one bucket's cached result could
  // leak into the other (e.g. an anon visitor served a logged-in-only listing)
  const cacheKey = `pins:${JSON.stringify(roundedBounds)}:${filterCacheKey(filters ?? {})}:${!!userId}`

  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const where = {
    status: 'ACTIVE',
    ...boundsFilter(bounds),
    ...buildWhereClause(filters),
  }
  applyVisibilityFilter(where, userId)
  const pins = await prisma.property.findMany({
    where,
    select: { id: true, lat: true, lng: true, rent: true, type: true, bhk: true, sharing: true, trustScore: { select: { badge: true } } },
    take: 200,
  })

  await cacheSet(cacheKey, pins, 30)
  return pins
}

// Live "Show N homes" count for the filter modal — same where-clause as
// /pins but a COUNT, uncapped by the 200-pin limit. Short TTL: the user is
// actively toggling filters while this is on screen.
export async function countPropertiesInBounds(bounds, filters, userId = null) {
  const cacheKey = `count:${JSON.stringify(bounds)}:${filterCacheKey(filters ?? {})}:${!!userId}`
  const cached = await cacheGet(cacheKey)
  if (cached !== null && cached !== undefined) return cached

  const where = { status: 'ACTIVE', ...boundsFilter(bounds) }
  const fragments = buildFilterWhere(filters ?? {})
  if (fragments.length) where.AND = fragments
  applyVisibilityFilter(where, userId)

  const count = await prisma.property.count({ where })
  await cacheSet(cacheKey, count, 15)
  return count
}

export async function getPropertyById(id, userId = null) {
  const property = await prisma.property.findUnique({ where: { id }, include: FULL_INCLUDE })
  if (!property) return null

  // Seed trust score on first view if it doesn't exist yet
  if (!property.trustScore) {
    try { property.trustScore = await recalculateTrustScore(id) } catch (_e) { /* best-effort */ }
  }

  // Attach ownerTrustScore separately (prisma.ownerTrustScore may be undefined until prisma generate is run)
  if (property.owner && typeof prisma.ownerTrustScore?.findUnique === 'function') {
    property.owner.ownerTrustScore = await prisma.ownerTrustScore.findUnique({ where: { ownerId: property.owner.id } }).catch(() => null)
  }

  property.rentBenchmark = await getRentBenchmark(property).catch(() => null)

  // Spatial intelligence for this listing's ~153m cell. A warm cell is one
  // indexed lookup with no external calls. A cold one waits up to 3s for the
  // computation it just started — long enough that most first views get real
  // data, short enough not to hold the page hostage. Past that it returns
  // `pending` and finishes in the background. Cells are warmed at
  // create/publish, so this rarely fires.
  // propertyType decides WHICH modules this listing sees: a shop gets commerce
  // and never "could you live here without a car?", a plot gets landContext.
  // See features/spatial/propertyTypes.js.
  // A failure here must not read as "this neighbourhood has nothing worth
  // reporting". `.catch(() => null)` used to collapse a DB error, a listing
  // with null coordinates, and a genuinely undescribed cell into one indistinct
  // null, and the panel rendered all three as a bare heading. Say which it was.
  property.spatialContext = await getContext(
    Number(property.lat), Number(property.lng),
    { waitMs: 3000, propertyType: property.type }
  ).catch((err) => {
    intelError('spatial.context_failed', err, { propertyId: property.id })
    return { modules: null, pending: false, status: STATUS_FAILED }
  })

  if (userId && property.ownerId === userId) return property
  if (property.status !== 'ACTIVE') return null
  return property
}

export async function getPropertiesByOwner(ownerId) {
  return prisma.property.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: { order: 'asc' } }, amenities: { include: { amenity: true } }, trustScore: true, riskScore: true, _count: { select: { appointments: true, reports: true } } },
  })
}

const MAX_LISTINGS_PER_OWNER = 3

function assertAllowedCity(city) {
  if (!SUPPORTED_CITIES.includes(city)) {
    throw Object.assign(new Error(`Listings are only available in ${SUPPORTED_CITIES.join(', ')} right now — more cities opening soon`), { statusCode: 403 })
  }
}

export async function createProperty(ownerId, data) {
  const { amenityIds = [], images = [], rules, availableFrom, type, ...propertyData } = data

  assertAllowedCity(data.city)

  const property = await prisma.$transaction(async (tx) => {
    const activeCount = await tx.property.count({ where: { ownerId, status: 'ACTIVE' } })
    if (activeCount >= MAX_LISTINGS_PER_OWNER) {
      throw Object.assign(new Error(`Maximum of ${MAX_LISTINGS_PER_OWNER} active listings reached — deactivate a listing to add another`), { statusCode: 403 })
    }

    return tx.property.create({
      data: {
        ...propertyData,
        type,
        displayId: generatePropertyDisplayId(type),
        ownerId,
        status: 'DRAFT',
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        images:    { create: images.map((url, i) => ({ url, isPrimary: i === 0, order: i })) },
        amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
        rules:     rules ? { create: rules } : undefined,
      },
      include: FULL_INCLUDE,
    })
  })

  // Fire-and-forget: seed trust score record + run the intelligence checks
  recalculateTrustScore(property.id).catch(() => {})
  evaluateListing(property.id, 'create')
  // Warm this listing's spatial cell now, so the neighbourhood is already
  // described by the time anyone opens the page. Free when a neighbouring
  // listing already warmed the same cell.
  ensureContextForProperty(property.lat, property.lng, property.type).catch(() => {})

  return property
}

export async function updateProperty(id, ownerId, data) {
  const { amenityIds, images, rules, availableFrom, ...propertyData } = data

  if (propertyData.city !== undefined) assertAllowedCity(propertyData.city)

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.property.findUnique({ where: { id, ownerId } })
    if (!existing) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })

    if (amenityIds !== undefined) {
      await tx.propertyAmenity.deleteMany({ where: { propertyId: id } })
    }
    if (images !== undefined) {
      await tx.propertyImage.deleteMany({ where: { propertyId: id } })
    }

    return tx.property.update({
      where: { id },
      data: {
        ...propertyData,
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        ...(images    !== undefined && { images:    { create: images.map((url, i) => ({ url, isPrimary: i === 0, order: i })) } }),
        ...(amenityIds !== undefined && { amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) } }),
        ...(rules     !== undefined && { rules:     { upsert: { create: rules, update: rules } } }),
      },
      include: FULL_INCLUDE,
    })
  })

  // Re-run the intelligence checks when identity-defining fields change —
  // create-time results are stale once the listing points somewhere else
  if (['address', 'lat', 'lng', 'city', 'rent'].some((f) => propertyData[f] !== undefined)) {
    evaluateListing(id, 'update')
  }

  return updated
}

export async function deleteProperty(id, ownerId) {
  const property = await prisma.property.findUnique({ where: { id, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return prisma.property.delete({ where: { id } })
}

export async function publishProperty(id, ownerId) {
  const property = await prisma.property.findUnique({ where: { id, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  if (property.status !== 'DRAFT' && property.status !== 'REJECTED') {
    throw Object.assign(new Error('Only draft or rejected properties can be submitted for review'), { statusCode: 400 })
  }
  const updated = await prisma.property.update({ where: { id }, data: { status: 'PENDING' } })

  // Fire-and-forget: re-evaluate at submission so the admin moderation queue
  // sees a current risk score, not the one from draft creation time
  evaluateListing(id, 'publish')
  ensureContextForProperty(property.lat, property.lng, property.type).catch(() => {})

  return updated
}

export async function toggleStatus(id, ownerId) {
  const prop = await prisma.property.findUnique({ where: { id, ownerId } })
  if (!prop) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  if (prop.status !== 'ACTIVE' && prop.status !== 'INACTIVE') {
    throw Object.assign(new Error('Only active or inactive listings can be toggled'), { statusCode: 400 })
  }
  const next = prop.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  return prisma.property.update({ where: { id }, data: { status: next } })
}

// All filter → Prisma mapping is generated from filters.registry.js.
// Fragments are AND-composed so two filters targeting the same column
// (e.g. rentMin + rentMax) can never clobber each other.
function buildWhereClause(filters) {
  const where = { status: 'ACTIVE' }
  const fragments = buildFilterWhere(filters)
  if (fragments.length) where.AND = fragments
  if (filters.swLat != null && filters.swLng != null && filters.neLat != null && filters.neLng != null) {
    Object.assign(where, boundsFilter(filters))
  }
  return where
}

/**
 * Filter out properties whose owner set visibility to HIDDEN,
 * and require auth for LOGGED_IN listings.
 * userId = null means unauthenticated visitor.
 */
function applyVisibilityFilter(where, userId) {
  if (userId) {
    // Logged-in user sees PUBLIC + LOGGED_IN, never HIDDEN
    where.owner = { ...where.owner, listingVisibility: { not: 'HIDDEN' } }
  } else {
    // Non-logged-in visitor sees only PUBLIC
    where.owner = { ...where.owner, listingVisibility: 'PUBLIC' }
  }
}

export async function getPublicStats() {
  const cacheKey = 'stats:public'
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const [totalActive, byCityRaw, ownerGroups] = await Promise.all([
    prisma.property.count({ where: { status: 'ACTIVE' } }),
    prisma.property.groupBy({ by: ['city'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
    prisma.property.groupBy({ by: ['ownerId'], where: { status: 'ACTIVE' } }),
  ])

  const stats = {
    totalActive,
    activeOwners: ownerGroups.length,
    cities: SUPPORTED_CITIES.length,
    byCity: Object.fromEntries(byCityRaw.map((r) => [r.city, r._count._all])),
  }

  await cacheSet(cacheKey, stats, 300)
  return stats
}

export async function getAllAmenities() {
  return prisma.amenity.findMany({ orderBy: { name: 'asc' } })
}

export async function markTenant(propertyId, ownerId, tenantId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  if (property.status !== 'ACTIVE') throw Object.assign(new Error('Only active properties can be marked as occupied'), { statusCode: 400 })
  if (tenantId === ownerId) throw Object.assign(new Error('Owner cannot be marked as tenant'), { statusCode: 400 })

  const tenant = await prisma.user.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenant) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  return prisma.property.update({
    where: { id: propertyId },
    data: { status: 'OCCUPIED', currentTenantId: tenantId, occupiedSince: new Date() },
    include: { currentTenant: { select: { id: true, name: true, avatarUrl: true } } },
  })
}

export async function getPropertyContacts(propertyId, ownerId) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    select: {
      id: true,
      ownerId: true,
      appointments: {
        select: {
          id: true, status: true, requestedDate: true, requestedTime: true,
          message: true, ownerNote: true, contactNumber: true, tenantId: true, createdAt: true,
          tenant: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      conversations: {
        select: {
          id: true, tenantId: true, lastMessageAt: true,
          tenant: { select: { id: true, name: true, email: true, avatarUrl: true } },
          messages: {
            select: { id: true, senderId: true, body: true, createdAt: true, sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      },
      savedBy: {
        select: { userId: true, createdAt: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { appointments: true, conversations: true, savedBy: true } },
    },
  })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return property
}

export async function vacateProperty(propertyId, ownerId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  if (property.status !== 'OCCUPIED') throw Object.assign(new Error('Property is not currently occupied'), { statusCode: 400 })

  return prisma.property.update({
    where: { id: propertyId },
    data: { status: 'ACTIVE', currentTenantId: null, occupiedSince: null },
  })
}
