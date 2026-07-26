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
import { encode } from '../../lib/geohash.js'
import { resolveProximityFilter, proximityCacheKey } from './proximityFilter.js'
import { notifyUser } from '../notifications/notifications.service.js'

// The land-record IDENTIFIERS, which never leave the server for anyone but the
// listing's own owner. Enforced here rather than by omitting them from a
// select, because both read paths use `include` and would silently start
// leaking the next column added to the model.
//
// `landRecordType` ("A-khata", "Patta") is deliberately NOT in this list: which
// KIND of record exists is a quality signal a buyer must see — B-khata land
// cannot be mortgaged — while the number is what turns a public listing into a
// land-fraud kit. Same shape as the owner-phone rule below: withhold server
// side, never client side.
const PRIVATE_RECORD_FIELDS = ['surveyNumber', 'subdivisionNumber', 'landRecordNumber']

export function stripPrivateRecords(property, userId = null) {
  if (!property) return property
  if (userId && property.ownerId === userId) return property
  for (const field of PRIVATE_RECORD_FIELDS) {
    if (field in property) delete property[field]
  }
  return property
}

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

  // Resolved against the where clause as it stands BEFORE the proximity
  // constraint, so `unknown` counts listings this filter set aside for lack of
  // data rather than every listing in the country.
  const proximity = await resolveProximityFilter(filters, where)
  if (proximity) Object.assign(where, proximity.where)

  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { images: { where: { isPrimary: true }, take: 1 }, trustScore: true, riskScore: true } }),
    prisma.property.count({ where }),
  ])

  // Surfaced, not swallowed. A listing excluded because we have no map data for
  // its area is not a listing we judged and rejected — and a filtered list is
  // the one surface with nowhere to put a provenance chip, so the count travels
  // with the response instead.
  return {
    properties: properties.map((p) => stripPrivateRecords(p, userId)),
    total,
    ...(proximity && {
      proximity: { unknown: proximity.unknown, label: proximity.label },
    }),
  }
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
  const cacheKey = `pins:${JSON.stringify(roundedBounds)}:${filterCacheKey(filters ?? {})}:${proximityCacheKey(filters)}:${!!userId}`

  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const where = {
    status: 'ACTIVE',
    ...boundsFilter(bounds),
    ...buildWhereClause(filters),
  }
  applyVisibilityFilter(where, userId)

  // Same constraint on the map as in the list, or the two disagree about what
  // the filter means. Pins have nowhere to show the unknown count — the list
  // view carries that message.
  const proximity = await resolveProximityFilter(filters, where)
  if (proximity) Object.assign(where, proximity.where)

  const pins = await prisma.property.findMany({
    where,
    // pricingModel is here so a pin can LABEL itself: the same 4500000 in
    // `rent` is "₹45K/mo" on a rental and "₹45L" on a sale, and a pin that
    // guessed wrong would misprice every plot and flat on the map.
    select: { id: true, lat: true, lng: true, rent: true, pricingModel: true, type: true, bhk: true, sharing: true, trustScore: { select: { badge: true } } },
    take: 200,
  })

  await cacheSet(cacheKey, pins, 30)
  return pins
}

// Live "Show N homes" count for the filter modal — same where-clause as
// /pins but a COUNT, uncapped by the 200-pin limit. Short TTL: the user is
// actively toggling filters while this is on screen.
export async function countPropertiesInBounds(bounds, filters, userId = null) {
  const cacheKey = `count:${JSON.stringify(bounds)}:${filterCacheKey(filters ?? {})}:${proximityCacheKey(filters)}:${!!userId}`
  const cached = await cacheGet(cacheKey)
  if (cached !== null && cached !== undefined) return cached

  const where = { status: 'ACTIVE', ...boundsFilter(bounds) }
  const fragments = buildFilterWhere(filters ?? {})
  if (fragments.length) where.AND = fragments
  applyVisibilityFilter(where, userId)

  // Without this the "Show N homes" button promises a number the list cannot
  // deliver — the count would ignore the proximity filter the results obey.
  const proximity = await resolveProximityFilter(filters, where)
  if (proximity) Object.assign(where, proximity.where)

  const count = await prisma.property.count({ where })
  await cacheSet(cacheKey, count, 15)
  return count
}

// Three records of the same view, each answering a question the others can't:
//   viewCount          lifetime total, on the listing itself
//   PropertyDailyView  per day, so "last 30 days" is answerable
//   PropertyViewer     per identified person, for the one place the host
//                      dashboard shows it (see the schema comment)
//
// Called fire-and-forget from getPropertyById, already past the owner and
// ACTIVE guards, so it only ever records somebody else viewing a live listing.
async function recordView(propertyId, userId) {
  // Date-only key: the unique index is (propertyId, day), so the time of day
  // must be stripped or every view creates its own row.
  const day = new Date()
  day.setUTCHours(0, 0, 0, 0)

  await Promise.all([
    prisma.property.update({ where: { id: propertyId }, data: { viewCount: { increment: 1 } } }),
    prisma.propertyDailyView.upsert({
      where: { propertyId_day: { propertyId, day } },
      create: { propertyId, day, count: 1 },
      update: { count: { increment: 1 } },
    }),
    // Anonymous views are not attributable to anyone, so they stay in the
    // totals only.
    ...(userId ? [prisma.propertyViewer.upsert({
      where: { propertyId_userId: { propertyId, userId } },
      create: { propertyId, userId, count: 1, lastViewedAt: new Date() },
      update: { count: { increment: 1 }, lastViewedAt: new Date() },
    })] : []),
  ])
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

  // Owner phone is opt-in, enforced HERE — a number the viewer shouldn't see
  // must never leave the API (hiding it client-side is not privacy).
  // contactVisibility: EVERYONE → any viewer; LOGGED_IN (the default) → only
  // an authenticated viewer; NOBODY → never. The setting itself is not
  // returned — only the phone, and only when allowed.
  if (property.owner) {
    const ownerPrivacy = await prisma.user.findUnique({
      where: { id: property.owner.id },
      select: { phone: true, contactVisibility: true },
    })
    const visibility = ownerPrivacy?.contactVisibility ?? 'LOGGED_IN'
    const allowed = visibility === 'EVERYONE' || (visibility === 'LOGGED_IN' && !!userId)
    if (allowed && ownerPrivacy?.phone) property.owner.phone = ownerPrivacy.phone
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

  // Past the owner check and the ACTIVE check, so this counts what the owner
  // actually wants counted: someone else looking at a live listing. Their own
  // refreshes returned above and never reach here.
  //
  // Fire-and-forget — a failed counter must never cost someone the page. It is
  // a raw view count, not unique visitors: we don't fingerprint readers, so
  // display it as "views" and never as "people".
  // Wrapped in Promise.resolve so a synchronous throw can't escape either — a
  // counter that takes the page down with it is worse than no counter, and
  // `.catch()` alone only covers the rejection case.
  Promise.resolve(recordView(id, userId))
    .catch((err) => intelError('property.view_count_failed', err, { propertyId: id }))

  return stripPrivateRecords(property, userId)
}

export async function getPropertiesByOwner(ownerId) {
  return prisma.property.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: {
      images: { orderBy: { order: 'asc' } },
      amenities: { include: { amenity: true } },
      trustScore: true,
      riskScore: true,
      _count: {
        select: {
          // PENDING only, not every appointment ever made: this drives the
          // owner's "Visit requests · 2" action, which means requests WAITING
          // ON THEM. The unfiltered total had no consumer on either client.
          // (Prisma allows one count per relation and no aliases, so this is a
          // replacement rather than a second field.)
          appointments: { where: { status: 'PENDING' } },
          reports: true,
          savedBy: true,
        },
      },
    },
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
        // The listing's link to the spatial layer's per-cell data. Written here
        // rather than derived at query time because proximity filters join on
        // it, and a filter cannot join on a value it has to compute per row.
        geohash: encode(Number(propertyData.lat), Number(propertyData.lng)),
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

    const movedCoords = propertyData.lat !== undefined || propertyData.lng !== undefined

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
        // Recomputed whenever EITHER coordinate moves, using the existing value
        // for the one that didn't. `updatePropertySchema` marks lat and lng
        // optional INDEPENDENTLY, so `{ lat: 12.98 }` alone is a valid request —
        // and requiring both here meant that request wrote a new latitude while
        // leaving the geohash pointing at the cell the listing had left. A 0.01°
        // move is ~1.1km, about seven cells, and nothing on any request path
        // would ever repair it: proximity filters join on geohash alone, so the
        // listing would keep matching "within 800m of a station" on the strength
        // of an address it no longer has.
        ...(movedCoords && {
          geohash: encode(
            Number(propertyData.lat ?? existing.lat),
            Number(propertyData.lng ?? existing.lng)
          ),
        }),
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

  // Warm the cell the listing moved INTO. createProperty has always done this;
  // updateProperty never did, so a listing edited to a new address got a
  // correct new geohash pointing at a cell with no context and no proximity
  // rows — invisible to every proximity filter until somebody happened to open
  // its page, which for a draft may be never.
  if (propertyData.lat !== undefined || propertyData.lng !== undefined) {
    ensureContextForProperty(updated.lat, updated.lng, updated.type).catch(() => {})
  }

  return updated
}

// A listing is the OWNER's to delete — an admin can only pause it (see
// admin.service.js's setPropertyStatus). Two states make a delete the wrong
// action though, and both used to go through silently because this was a bare
// findUnique + delete:
//
//   1. A signed lease means somebody lives there. The row cascades, so
//      deleting the listing would erase the tenancy record both sides rely on.
//   2. A paused listing is under moderation. Letting the owner delete it while
//      we're looking into a report is how a bad actor clears the evidence and
//      relists clean.
//
// Everything else — draft, pending, active, inactive, rejected — is theirs to
// remove, and anyone with a live visit request is told rather than left
// wondering why the page 404s.
export async function deleteProperty(id, ownerId) {
  const property = await prisma.property.findUnique({
    where: { id, ownerId },
    select: {
      id: true, title: true, status: true,
      leases: { where: { status: 'ACTIVE' }, select: { id: true } },
      appointments: {
        where: { status: { in: ['PENDING', 'ACCEPTED', 'RESCHEDULED'] } },
        select: { tenantId: true },
      },
    },
  })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })

  if (property.leases.length) {
    throw Object.assign(
      new Error('This listing has a signed lease on it. Terminate the lease first — deleting it now would erase the tenancy record.'),
      { statusCode: 409 },
    )
  }

  if (property.status === 'SUSPENDED') {
    throw Object.assign(
      new Error('This listing is paused while StayOnMap reviews it, so it can’t be deleted yet. Reply to the notification and we’ll sort it out.'),
      { statusCode: 409 },
    )
  }

  const waitingTenants = [...new Set(property.appointments.map((a) => a.tenantId))]
  const deleted = await prisma.property.delete({ where: { id } })

  // Fire-and-forget, after the delete succeeded: never promise a removal that
  // then failed. Their appointment row is already gone with the cascade, so
  // this notification is the only trace they'd otherwise have.
  for (const tenantId of waitingTenants) {
    notifyUser(tenantId, {
      type: 'SYSTEM',
      title: 'A listing you were visiting was removed',
      body: `The owner has taken “${property.title}” off StayOnMap, so your visit is cancelled.`,
    }).catch(() => {})
  }

  return deleted
}

export async function publishProperty(id, ownerId) {
  const property = await prisma.property.findUnique({ where: { id, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  if (property.status !== 'DRAFT' && property.status !== 'REJECTED') {
    throw Object.assign(new Error('Only draft or rejected properties can be submitted for review'), { statusCode: 400 })
  }
  const updated = await prisma.property.update({ where: { id }, data: { status: 'PENDING', submittedAt: new Date() } })

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

// What comparable listings in this city actually ask — shown beside the price
// field while the owner is still typing, not after they publish.
//
// Deliberately a spread and a median, never a single "recommended price": we
// have no basis for telling someone what their home is worth, and a lone
// number reads as advice. A p25–p75 band with the sample size behind it says
// what is true and leaves the pricing decision where it belongs.
//
// Same comparability rule as the fraud-scan benchmark
// (services/intelligence.service.js): same city, same type, same size, same
// pricingModel — mixing a lease lump sum into monthly rents poisons the
// average. Minimum 3 comparables, or we report that we cannot say.
const BENCHMARK_MIN_SAMPLE = 3
const BENCHMARK_MAX_SAMPLE = 500

export async function getPriceBenchmark({ city, type, bhk, sharing, pricingModel = 'RENT' }) {
  const rows = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      city,
      type,
      pricingModel,
      ...(type === 'PG'
        ? (sharing ? { sharing } : {})
        : (bhk !== undefined ? { bhk } : {})),
    },
    select: { rent: true },
    take: BENCHMARK_MAX_SAMPLE,
  })

  if (rows.length < BENCHMARK_MIN_SAMPLE) {
    return { available: false, count: rows.length }
  }

  const values = rows.map((r) => Number(r.rent)).sort((a, b) => a - b)
  const at = (q) => values[Math.min(values.length - 1, Math.floor(q * values.length))]

  return {
    available: true,
    count: values.length,
    p25: Math.round(at(0.25)),
    median: Math.round(at(0.5)),
    p75: Math.round(at(0.75)),
  }
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
