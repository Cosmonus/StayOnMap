import { prisma } from '../../lib/prisma.js'
import { boundsFilter } from '../../utils/geo.js'
import { recalculateRiskScore, recalculateTrustScore } from '../trust/trust.service.js'
import { runFraudScan } from '../ai/ai.service.js'
import { generatePropertyDisplayId } from '../../utils/idGenerator.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'

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
  const cacheKey = `pins:${JSON.stringify({ b: roundedBounds, city: filters?.city ?? '', bhk: filters?.bhk ?? '', furnished: filters?.furnished ?? '' })}`

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
    select: { id: true, lat: true, lng: true, rent: true, type: true, trustScore: { select: { badge: true } } },
    take: 200,
  })

  await cacheSet(cacheKey, pins, 30)
  return pins
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

const ALLOWED_CITIES = ['Bengaluru', 'Chennai']

export async function createProperty(ownerId, data) {
  const { amenityIds = [], images = [], rules, availableFrom, type, ...propertyData } = data

  if (!ALLOWED_CITIES.includes(data.city)) {
    throw Object.assign(new Error('Listings are only available in Bengaluru and Chennai'), { statusCode: 403 })
  }

  const property = await prisma.$transaction(async (tx) => {
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

  // Fire-and-forget: seed trust score record + detect duplicates
  recalculateTrustScore(property.id).catch(() => {})
  detectDuplicates(property.id, property.address, property.lat, property.lng, ownerId).catch(() => {})

  return property
}

export async function updateProperty(id, ownerId, data) {
  const { amenityIds, images, rules, availableFrom, ...propertyData } = data

  return prisma.$transaction(async (tx) => {
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
  return prisma.property.update({ where: { id }, data: { status: 'PENDING' } })
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

function buildWhereClause(filters) {
  const where = { status: 'ACTIVE' }
  if (filters.city)      where.city = { contains: filters.city, mode: 'insensitive' }
  if (filters.furnished) where.furnished = filters.furnished
  if (filters.bhk)       where.bhk = { in: String(filters.bhk).split(',').map(Number) }
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

async function detectDuplicates(propertyId, address, lat, lng, ownerId) {
  const normalized = address.toLowerCase().trim()

  const [dupAddress, _sameListing] = await Promise.all([
    prisma.property.findFirst({ where: { address: { equals: normalized, mode: 'insensitive' }, id: { not: propertyId } } }),
    prisma.property.findFirst({ where: { ownerId, id: { not: propertyId }, status: { not: 'REJECTED' } } }),
  ])

  const signals = []
  if (dupAddress) signals.push({ propertyId, type: 'DUPLICATE_ADDRESS', detail: `Matches property ${dupAddress.id}` })

  const FIFTY_METERS = 0.00045
  const nearby = await prisma.property.findFirst({
    where: { id: { not: propertyId }, lat: { gte: Number(lat) - FIFTY_METERS, lte: Number(lat) + FIFTY_METERS }, lng: { gte: Number(lng) - FIFTY_METERS, lte: Number(lng) + FIFTY_METERS } },
  })
  if (nearby) signals.push({ propertyId, type: 'SIMILAR_GEOLOCATION', detail: `Within 50m of property ${nearby.id}` })

  if (signals.length > 0) {
    await prisma.fraudSignal.createMany({ data: signals })
    await recalculateRiskScore(propertyId)
  }

  // AI fraud scan (stub)
  await runFraudScan(propertyId)
}
