// What people searched for, and whether we had anything to show them.
//
// The funnel in analytics.service.js measures what people DID. It cannot
// measure what they wanted and we did not have, and with inventory as the
// binding constraint that is the more useful of the two: a zero-result search in
// Anna Nagar for a 2BHK under ₹25k is a precise instruction about which listing
// to go and get.
//
// THREE PROPERTIES OF THIS TABLE, all deliberate:
//
//   • AGGREGATE, NOT AN EVENT LOG. One row per (day, query shape) with counters.
//     A million searches for the same thing is one row. Bounded by the variety
//     of what people ask, not by traffic.
//
//   • NO PERSON IN IT. No sessionId, no userId, no IP, and nowhere to put one.
//     "How much demand for what, where" needs no person attached. A table that
//     cannot identify anyone cannot leak one. Personalization inputs are a
//     different thing and already exist per-user in SavedListing/PropertyViewer.
//
//   • COARSE ON PURPOSE. The area is a geohash-5 (~4.9km) of the viewport
//     centre, and the budget is a band. Both quantise: nudging the map by a
//     street or dragging a slider one tick does not fork a row. Precision here
//     would buy noise and cost privacy.
import { prisma } from '../../lib/prisma.js'
import { createHash } from 'crypto'
import { encode } from '../../lib/geohash.js'

// ~4.9km x 4.9km. Chosen to be about "a part of a city" — fine enough to say
// Anna Nagar rather than Chennai, blunt enough that it locates nobody.
const AREA_PRECISION = 5

// A year, so the readout can compare a month against the same month last year.
// Longer than AnalyticsEvent's 90 days, and safely so: that table carries a
// userId and this one carries no personal data at all, so retention here is a
// storage question rather than a privacy one.
export const DEMAND_RETENTION_DAYS = 365

/**
 * Budget as a band.
 *
 * The bands are wide and uneven because Indian rents are: the gap between
 * ₹5k and ₹10k is a different kind of home, the gap between ₹95k and ₹100k is
 * rounding. `null` when no budget filter was set — which is itself a signal
 * worth keeping distinct from "any budget".
 */
export function rentBand(min, max) {
  const value = Number(max ?? min)
  if (!Number.isFinite(value) || value <= 0) return null
  if (value <= 10_000) return '0-10k'
  if (value <= 20_000) return '10k-20k'
  if (value <= 35_000) return '20k-35k'
  if (value <= 60_000) return '35k-60k'
  if (value <= 100_000) return '60k-1L'
  return '1L+'
}

/** Centre of a viewport, or null if the bounds are incomplete. */
function centreOf(bounds) {
  const { swLat, swLng, neLat, neLng } = bounds ?? {}
  if ([swLat, swLng, neLat, neLng].some((v) => v == null || !Number.isFinite(Number(v)))) return null
  return {
    lat: (Number(swLat) + Number(neLat)) / 2,
    lng: (Number(swLng) + Number(neLng)) / 2,
  }
}

/**
 * The query shape, reduced to the handful of dimensions worth acting on.
 *
 * Deliberately NOT the whole ~40-filter set. A signature carrying every amenity
 * toggle would be unique per user and the table would degenerate into the event
 * log this is designed not to be. These five are the ones an answer to "what
 * should we go and list next" is actually phrased in.
 */
export function demandShape(bounds, filters = {}) {
  const centre = centreOf(bounds)
  if (!centre) return null

  return {
    cellGeohash: encode(centre.lat, centre.lng, AREA_PRECISION),
    city: filters.city ?? null,
    // Multi-value filters arrive as CSV; a single choice is the only one worth
    // recording, because "APARTMENT,HOUSE,LAND" is not a thing anyone is short of.
    type: single(filters.type),
    pricingModel: filters.pricingModel ?? null,
    bhk: toInt(single(filters.bhk)),
    rentBand: rentBand(filters.rentMin, filters.rentMax),
  }
}

const single = (v) => {
  if (v == null) return null
  const parts = String(v).split(',').filter(Boolean)
  return parts.length === 1 ? parts[0] : null
}

const toInt = (v) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export function signatureOf(shape) {
  return createHash('sha1')
    .update(JSON.stringify([
      shape.cellGeohash, shape.city, shape.type,
      shape.pricingModel, shape.bhk, shape.rentBand,
    ]))
    .digest('hex')
    .slice(0, 32)
}

/**
 * Record one search.
 *
 * Fire-and-forget and swallows everything, on the same principle as
 * analytics.service.js: recording must never be able to break the thing being
 * recorded. A lost row is a rounding error; a thrown one is a blank map.
 *
 * Called from BOTH the cache-hit and cache-miss paths of getPinsInBounds. A
 * search someone performed is a search whether or not we happened to have the
 * answer in Redis — counting only misses would undercount demand by exactly the
 * amount that popular areas are popular.
 */
export function recordSearchDemand(bounds, filters, resultCount) {
  // The WHOLE body is guarded, not just the write. `demandShape` is called
  // synchronously on the map's hottest path, and a throw there — a malformed
  // bound, an unexpected filter shape — would propagate into getPinsInBounds and
  // blank the map. The async path was already safe; this closes the sync one.
  // Losing a demand row is a rounding error; losing the map is the product.
  try {
    const shape = demandShape(bounds, filters)
    if (!shape) return
    void upsertDemand(shape, resultCount).catch(() => {})
  } catch {
    // Deliberately silent: this is telemetry about searches, and a logger on
    // this path would fire once per pan.
  }
}

async function upsertDemand(shape, resultCount) {
  const signature = signatureOf(shape)
  const day = new Date()
  day.setUTCHours(0, 0, 0, 0)
  const zero = resultCount === 0 ? 1 : 0

  await prisma.searchDemand.upsert({
    where: { day_signature: { day, signature } },
    create: {
      day, signature, ...shape,
      searches: 1,
      zeroResults: zero,
      lastResultCount: resultCount ?? null,
    },
    update: {
      searches: { increment: 1 },
      zeroResults: { increment: zero },
      lastResultCount: resultCount ?? null,
    },
  })

  schedulePrune()
}

// Same trick as analytics.service.js's prune: ride an insert, at most once per
// process per day, rather than adding a second scheduler for one DELETE.
let lastPruneDay = null

function schedulePrune() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastPruneDay === today) return
  lastPruneDay = today
  pruneOldDemand().catch(() => {})
}

export async function pruneOldDemand(now = new Date()) {
  const cutoff = new Date(now.getTime() - DEMAND_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count } = await prisma.searchDemand.deleteMany({ where: { day: { lt: cutoff } } })
  return count
}

/**
 * The readout: where demand went unmet.
 *
 * Ordered by zero-result searches, not by total searches — a popular area we
 * already serve well is not an instruction to do anything. This list is meant
 * to be read as "go and find listings here, in this shape".
 *
 * Data with no readout is a table, not instrumentation (analytics.service.js's
 * own words). This is the readout.
 */
export async function getUnmetDemand({ days = 30, limit = 20 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  since.setUTCHours(0, 0, 0, 0)

  const rows = await prisma.searchDemand.groupBy({
    by: ['cellGeohash', 'city', 'type', 'pricingModel', 'bhk', 'rentBand'],
    where: { day: { gte: since } },
    _sum: { searches: true, zeroResults: true },
    orderBy: { _sum: { zeroResults: 'desc' } },
    take: limit,
  })

  const shaped = rows
    .map((r) => ({
      cellGeohash: r.cellGeohash,
      city: r.city,
      type: r.type,
      pricingModel: r.pricingModel,
      bhk: r.bhk,
      rentBand: r.rentBand,
      searches: r._sum.searches ?? 0,
      zeroResults: r._sum.zeroResults ?? 0,
    }))
    .filter((r) => r.zeroResults > 0)

  const totals = await prisma.searchDemand.aggregate({
    where: { day: { gte: since } },
    _sum: { searches: true, zeroResults: true },
  })

  const searches = totals._sum.searches ?? 0
  const zeroResults = totals._sum.zeroResults ?? 0

  return {
    days,
    searches,
    zeroResults,
    // The single number worth watching: what share of searches found nothing.
    // Quoted against ALL searches, not against the rows below, so the headline
    // cannot drift from the detail.
    zeroResultRate: searches > 0 ? Math.round((zeroResults / searches) * 1000) / 10 : null,
    unmet: shaped,
  }
}
