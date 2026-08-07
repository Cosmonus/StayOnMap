// "Homes like this one" — the SIMILAR_TO edge.
//
// THE RULE THAT SHAPES THIS FILE: StayOnMap lists six categories, and what makes
// two listings alike is not the same question for any two of them. A generic
// scorer comparing `bhk` and `rent` would be silently wrong for four of the six
// — a plot has no bedrooms, a PG bed is priced per month per person, a short
// stay is priced per night, and a shop is compared on carpet area and frontage.
// So the per-type answer is DECLARED in one table, following
// features/spatial/propertyTypes.js, rather than scattered through conditionals.
//
// Two hard gates run before any scoring, and both exist because breaking either
// produces a confidently wrong recommendation rather than a weak one:
//
//   1. COMPARABLE TYPE ONLY. A plot is never "similar to" a flat. Types are
//      grouped (the four residential styles are mutually comparable; everything
//      else only matches itself), because a renter choosing between a villa and
//      an independent house is choosing between two homes, while a renter
//      shown a warehouse has been failed.
//
//   2. SAME PRICING MODEL. `rent` holds a monthly rent on a RENT listing and a
//      lakh-scale lump sum on LEASE or SALE. Comparing across them is the exact
//      bug the rent benchmark in intelligence.service.js already had to fix —
//      it averages ₹28,000 with ₹80,00,000 and calls the result a market.
import { prisma } from '../../lib/prisma.js'
import { haversineMeters } from '../../lib/geohash.js'
import { intelError, intelLog } from '../../lib/intelLog.js'
import { RESIDENTIAL_TYPES } from '../spatial/propertyTypes.js'

/** How many neighbours to keep per listing. */
export const TOP_K = 12

/**
 * How far away a listing can be and still be "like this one", per type.
 *
 * Not one radius, because relevance decays at different rates. Somebody
 * choosing a PG bed or a short stay is anchored to a specific spot — a bed 8km
 * away is a different life. A plot buyer or a shop tenant is shopping a
 * corridor, not a street.
 */
const RADIUS_M = {
  RESIDENTIAL: 6_000,
  PG: 4_000,
  SHORT_STAY: 5_000,
  COMMERCIAL: 10_000,
  LAND: 15_000,
}

/**
 * Which types may be compared with which.
 *
 * The four residential styles share a group: they answer the same question
 * ("should I live here?") and a renter genuinely cross-shops them. Everything
 * else is an island, because nothing else substitutes for it.
 */
export function comparableTypes(type) {
  return RESIDENTIAL_TYPES.includes(type) ? RESIDENTIAL_TYPES : [type]
}

const groupOf = (type) => (RESIDENTIAL_TYPES.includes(type) ? 'RESIDENTIAL' : type)

/**
 * The size dimension that means something for this type, and how much slack to
 * allow before two listings stop being alike.
 *
 * `tolerance` is the fraction of difference at which the size component reaches
 * zero. Wider for land (a 2400 and a 3600 sqft plot are both "a plot") than for
 * a PG (sharing 2 and sharing 5 are different products).
 */
const SIZE_DIMENSION = {
  RESIDENTIAL: { field: 'bhk', tolerance: 0.5, label: 'bedrooms' },
  PG: { field: 'sharing', tolerance: 0.4, label: 'sharing' },
  SHORT_STAY: { field: 'maxGuests', tolerance: 0.6, label: 'guests' },
  COMMERCIAL: { field: 'carpetArea', tolerance: 0.8, label: 'carpet area' },
  LAND: { field: 'extent', tolerance: 1.0, label: 'extent' },
}

/**
 * The categorical attributes worth matching, per type.
 *
 * Each is a field whose EQUALITY carries meaning. `furnished` matters for a
 * home and is meaningless for a plot; `approvalStatus` decides whether a plot is
 * financeable and does not exist for a flat.
 */
const ATTRIBUTES = {
  RESIDENTIAL: ['furnished'],
  PG: ['furnished'],
  SHORT_STAY: ['placeType'],
  COMMERCIAL: ['commercialType'],
  LAND: ['landType', 'approvalStatus'],
}

/** What the four components are worth. Location dominates: in rentals it is the
 *  one thing that cannot be changed after moving in. */
const COMPONENT_WEIGHTS = { location: 0.40, price: 0.30, size: 0.20, attributes: 0.10 }

/** The columns any type's scorer might read. */
const SELECT = {
  id: true, type: true, pricingModel: true, status: true,
  lat: true, lng: true, localityId: true, city: true,
  rent: true, nightlyRate: true,
  bhk: true, sharing: true, maxGuests: true, carpetArea: true, extent: true,
  furnished: true, placeType: true, commercialType: true, landType: true, approvalStatus: true,
}

/**
 * The price a listing is actually shopped on.
 *
 * A short stay is chosen on its nightly rate; everything else on `rent`, which
 * `pricingModel` already tells us how to read. Returns null when there is no
 * usable number, and a null price means the price component is SKIPPED rather
 * than scored as zero — see `score()`.
 */
function priceOf(property) {
  const raw = property.type === 'SHORT_STAY'
    ? (property.nightlyRate ?? property.rent)
    : property.rent
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 1 when identical, decaying to 0 at `tolerance` relative difference. */
function closeness(a, b, tolerance) {
  if (a == null || b == null) return null
  const x = Number(a); const y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const base = Math.max(Math.abs(x), Math.abs(y))
  if (base === 0) return 1
  const diff = Math.abs(x - y) / base
  return Math.max(0, 1 - diff / tolerance)
}

/**
 * Score one candidate against a subject. Returns null when they are not
 * comparable at all.
 *
 * A component that CANNOT be computed (a missing price, an unrecorded carpet
 * area) is dropped from the blend and its weight redistributed, rather than
 * scored as zero. Scoring absent data as maximum dissimilarity would rank a
 * listing down for the sin of having a blank field, which is a data-entry
 * artefact and not a fact about the property.
 */
export function score(subject, candidate) {
  if (candidate.id === subject.id) return null
  if (!comparableTypes(subject.type).includes(candidate.type)) return null
  // Different money means different question — see the header.
  if ((candidate.pricingModel ?? 'RENT') !== (subject.pricingModel ?? 'RENT')) return null

  const group = groupOf(subject.type)
  const radius = RADIUS_M[group] ?? 6_000

  const components = {}

  // ── Location. Beyond the radius they are not alternatives at all.
  if (subject.lat != null && subject.lng != null && candidate.lat != null && candidate.lng != null) {
    const metres = haversineMeters(
      Number(subject.lat), Number(subject.lng),
      Number(candidate.lat), Number(candidate.lng),
    )
    if (metres > radius) return null
    components.location = 1 - metres / radius
    // Same resolved area is worth more than the raw distance suggests: an
    // administrative boundary is often the difference between two streets that
    // feel like one neighbourhood and two that do not.
    if (subject.localityId && subject.localityId === candidate.localityId) {
      components.location = Math.min(1, components.location + 0.15)
    }
  } else if (subject.city && candidate.city && subject.city !== candidate.city) {
    // No coordinates to compare, but different cities is decisive on its own.
    return null
  }

  // ── Price, read through pricingModel.
  const price = closeness(priceOf(subject), priceOf(candidate), 0.6)
  if (price != null) components.price = price

  // ── Size, on whichever dimension this type is shopped by.
  const dimension = SIZE_DIMENSION[group]
  if (dimension) {
    const size = closeness(subject[dimension.field], candidate[dimension.field], dimension.tolerance)
    if (size != null) components.size = size
  }

  // ── Categorical attributes, only those that mean something for this type.
  const fields = ATTRIBUTES[group] ?? []
  const comparable = fields.filter((f) => subject[f] != null && candidate[f] != null)
  if (comparable.length) {
    const matches = comparable.filter((f) => subject[f] === candidate[f]).length
    components.attributes = matches / comparable.length
  }

  // Blend over the components that exist, renormalising their weights.
  const present = Object.keys(components)
  if (!present.length) return null
  const total = present.reduce((sum, k) => sum + COMPONENT_WEIGHTS[k], 0)
  const blended = present.reduce((sum, k) => sum + components[k] * COMPONENT_WEIGHTS[k], 0) / total

  return {
    score: Math.round(blended * 1000) / 1000,
    reasons: {
      ...Object.fromEntries(present.map((k) => [k, Math.round(components[k] * 100) / 100])),
      // What was NOT considered, so a surprising match is explainable rather
      // than mysterious.
      skipped: Object.keys(COMPONENT_WEIGHTS).filter((k) => !present.includes(k)),
    },
  }
}

/**
 * Recompute one listing's neighbours and store them.
 *
 * Fire-and-forget from the property write path; never throws. A listing whose
 * similarity fails to compute simply has no "similar homes" row, which is what
 * every listing had before this existed.
 */
export async function refreshSimilarity(propertyId) {
  const started = Date.now()
  try {
    const subject = await prisma.property.findUnique({ where: { id: propertyId }, select: SELECT })
    if (!subject) return 0

    // Only ACTIVE listings are candidates, in both directions: recommending a
    // draft or a suspended listing sends someone to a page they cannot open.
    const candidates = await prisma.property.findMany({
      where: {
        id: { not: propertyId },
        status: 'ACTIVE',
        type: { in: comparableTypes(subject.type) },
        pricingModel: subject.pricingModel ?? 'RENT',
      },
      select: SELECT,
      // A guard, not an expected limit. Beyond this the answer is a bbox
      // prefilter on the candidate query, the same shape the POI scan uses.
      take: 5_000,
    })

    const scored = candidates
      .map((candidate) => {
        const result = score(subject, candidate)
        return result && { similarId: candidate.id, ...result }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K)

    await prisma.$transaction([
      // Replace wholesale. An edge that no longer scores must disappear, and a
      // partial update would leave yesterday's neighbours mixed with today's.
      prisma.propertySimilarity.deleteMany({ where: { propertyId } }),
      ...(scored.length
        ? [prisma.propertySimilarity.createMany({
          data: scored.map((s) => ({ propertyId, similarId: s.similarId, score: s.score, reasons: s.reasons })),
        })]
        : []),
    ])

    intelLog('graph.similarity_refreshed', { propertyId, neighbours: scored.length, ms: Date.now() - started })
    return scored.length
  } catch (err) {
    intelError('graph.similarity_failed', err, { propertyId })
    return 0
  }
}

/**
 * Recompute a listing's edges AND the edges of the neighbours it found.
 *
 * For the moment a listing becomes ACTIVE. Computing only its own edges leaves
 * the relationship one-way: the new listing knows what it resembles, but no
 * existing listing points back at it, so it is invisible in every "similar
 * homes" row until those listings happen to be edited. That is a real freshness
 * gap and it would look like the feature simply not working.
 *
 * Bounded at TOP_K reverse recomputes — O(k), not the O(n) a full sweep would
 * cost — and deliberately ONE level deep: the neighbours' neighbours are not
 * touched, because that is how a cheap fix becomes a cascade.
 */
export async function refreshSimilarityWithNeighbours(propertyId) {
  const count = await refreshSimilarity(propertyId)
  if (!count) return 0

  const neighbours = await prisma.propertySimilarity.findMany({
    where: { propertyId },
    select: { similarId: true },
    take: TOP_K,
  })

  // Sequential on purpose: this is background work on a rare event, and firing
  // a dozen full candidate scans at the database at once to save a second is a
  // bad trade against the requests real users are waiting on.
  for (const { similarId } of neighbours) {
    await refreshSimilarity(similarId)
  }
  return count
}

/**
 * The stored neighbours of a listing, ready to render.
 *
 * Re-checks `status` at read time on purpose: an edge is only as fresh as the
 * last recompute of ITS row, so a listing paused an hour ago can still be
 * pointed at by a neighbour nobody has touched since.
 */
export async function getSimilar(propertyId, limit = 6) {
  const rows = await prisma.propertySimilarity.findMany({
    where: { propertyId, similar: { status: 'ACTIVE' } },
    orderBy: { score: 'desc' },
    take: limit,
    select: {
      score: true,
      reasons: true,
      similar: {
        select: {
          id: true, title: true, type: true, bhk: true, sharing: true, rent: true,
          pricingModel: true, nightlyRate: true, city: true, landmark: true,
          extent: true, extentUnit: true, carpetArea: true, maxGuests: true,
          area: true, furnished: true,
          images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          trustScore: { select: { badge: true } },
        },
      },
    },
  })

  return rows.map((r) => ({ ...r.similar, similarity: { score: r.score, reasons: r.reasons } }))
}
