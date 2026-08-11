// Reads PoiIndex — the self-hosted OpenStreetMap POI table.
//
// This is the free replacement for Google Places Nearby. A radius search is a
// bounding-box scan on the (category, lat, lng) composite index followed by a
// haversine filter in JS. No PostGIS, and none needed at this row count — see
// docs/spatial-intelligence.md §3 for the three things that would change that.
//
// The table is seeded by scripts/fetch-osm-pois.mjs and is EMPTY in a fresh
// checkout. Callers must handle `available: false` by falling back (the
// lifestyle module falls back to Google) rather than reporting "nothing
// nearby", which would be a finding rather than the absence of one.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { haversineMeters } from '../../lib/geohash.js'
import { intelError } from '../../lib/intelLog.js'
import { coverageFactor, freshnessFactor } from './dataQuality.js'
import { footprintFor } from './poiPolicy.js'

const DEG_LAT_M = 111_320

// Below this density of POIs (per km² of the searched circle), in a city we
// know IS seeded, the area is more likely under-mapped than genuinely empty.
// That distinction is the whole reason the threshold exists: OSM coverage in
// India varies enormously between and within cities, and "no shops" versus
// "nobody mapped the shops" are different claims.
//
// A DENSITY, not a fixed count: the old fixed 12 fired almost always at
// commerce's 300 m radius and almost never at landContext's 5 km, because it
// never normalised by area. 1.5/km² is the same bar the old value set at the
// lifestyle radius (12 POIs over a 1.6 km circle ≈ 8 km²).
const SPARSE_DENSITY_PER_KM2 = 1.5

export function sparseThreshold(radiusM) {
  const areaKm2 = Math.PI * (radiusM / 1000) ** 2
  return Math.max(3, Math.round(SPARSE_DENSITY_PER_KM2 * areaKm2))
}

// One real-world place is often mapped twice in OSM — a node AND the building
// way, or two nodes for the same branch. Rows are distinct osmIds, so the
// query layer collapses them:
//   - same category + same normalised name/brand within range → one place
//   - an unnamed row close to an already-kept same-category row is almost
//     always the node/way double of it, not a second real place
//
// The ranges are per category since 2026-08-11 (poiPolicy.js's FOOTPRINTS).
// The flat 30/150 m pair this replaced was one number doing two incompatible
// jobs: 150 m merges two genuinely different cafes on an Indian high street,
// and still splits a hospital campus mapped as six separate blocks.

// Whether a city has been seeded at all changes only when someone re-runs the
// ingestion script (which now busts these keys on completion — see
// scripts/fetch-osm-pois.mjs), so this can be cached hard.
const COVERAGE_TTL_S = 60 * 60

// The bbox scan pages until it has genuinely seen the whole box. This ceiling
// is a runaway backstop, not a working limit — if it ever trips, the result
// says so via `truncated` instead of silently undercounting. The previous
// implementation took an UN-ordered 2000-row slice, which in a dense cell
// could drop the true nearest POI entirely.
const PAGE_SIZE = 2000
const MAX_ROWS = 20_000

// Rows a re-seed found missing are marked ABSENT_FROM_SOURCE rather than
// deleted (seedMaintenance.js's markAbsentPois, 2026-08-11). Every serving
// query therefore carries this predicate, and the result is byte-identical to
// what the old hard-delete produced — an absent row is exactly as invisible as
// a deleted one, it is simply still there to count.
//
// One constant, spread into all five reads, because a query that forgets it
// does not fail: it silently starts telling users about a chemist that closed,
// which is the single most credibility-damaging thing this table can do.
// tests/poi-lifecycle.test.js asserts every read carries it.
export const SERVING = { status: 'ACTIVE' }

/**
 * Has PoiIndex been seeded for this city?
 * @returns {Promise<number>} row count (0 = not seeded)
 */
export async function poiCoverage(city) {
  if (!city) return 0
  const key = `spatial:poicov:${city}`
  const cached = await cacheGet(key)
  if (cached !== null && typeof cached === 'number') return cached

  try {
    const count = await prisma.poiIndex.count({ where: { ...SERVING, city } })
    await cacheSet(key, count, COVERAGE_TTL_S)
    return count
  } catch (err) {
    intelError('spatial.poi_coverage_failed', err, { city })
    return 0
  }
}

/**
 * When the city's OSM data was last fetched — the honest `fetchedAt` for the
 * OpenStreetMap source line. Null when unknown (never fabricated).
 */
export async function poiFreshness(city) {
  if (!city) return null
  const key = `spatial:poifresh:${city}`
  const cached = await cacheGet(key)
  if (cached?.v !== undefined) return cached.v

  try {
    const agg = await prisma.poiIndex.aggregate({ where: { ...SERVING, city }, _max: { fetchedAt: true } })
    const iso = agg._max.fetchedAt ? agg._max.fetchedAt.toISOString().slice(0, 10) : null
    // Wrapped in { v } — cacheGet collapses "miss" and "stored null" otherwise.
    await cacheSet(key, { v: iso }, COVERAGE_TTL_S)
    return iso
  } catch (err) {
    intelError('spatial.poi_freshness_failed', err, { city })
    return null
  }
}

// osmSourceMeta(city) lived here until 2026-08-10 with no importer, and it was
// SUPERSEDED rather than merely unused: it stamped a source line with the
// city's overall fetch date, while every module now spreads
// `{ ...OSM_POI_SOURCE, fetchedAt: <that result's own fetchedAt> }` — which is
// the more honest number, since a cell's data can be older than the city's
// newest fetch.

/**
 * Fetch every row in a bbox, paging by id so the scan is exhaustive and
 * deterministic. Returns { rows, truncated } — truncated only at MAX_ROWS.
 */
async function bboxScan(where, select) {
  const rows = []
  let cursor = null
  for (;;) {
    const page = await prisma.poiIndex.findMany({
      where,
      select: { id: true, ...select },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { rows, truncated: false }
    if (rows.length >= MAX_ROWS) return { rows, truncated: true }
    cursor = page[page.length - 1].id
  }
}

function normalizedName(poi) {
  const raw = poi.name ?? poi.brand ?? null
  return raw ? raw.toLowerCase().replace(/\s+/g, ' ').trim() : null
}

/**
 * Collapse node/way doubles within one category's distance-sorted list.
 * The list is nearest-first, so the kept copy is always the nearest one.
 *
 * Comparing every pair would be O(n²), and landContext scans 5 km where
 * `retail` runs to thousands of rows. The input is sorted by distance from
 * the origin, so the triangle inequality bounds the search: if two POIs'
 * distances-from-origin differ by more than the duplicate radius, they are
 * necessarily farther apart than it and cannot be duplicates. Walking `kept`
 * backwards and breaking on that gap turns this into a narrow window scan.
 */
export function dedupeCategory(sorted, category = null) {
  // One lookup for the whole list — every row here is the same category by
  // construction (the caller groups first), so re-deriving it per row would be
  // the same answer computed a thousand times.
  const { unnamedM, namedM } = footprintFor(category ?? sorted[0]?.category)
  const kept = []
  for (const poi of sorted) {
    const name = normalizedName(poi)
    let isDup = false

    for (let i = kept.length - 1; i >= 0; i--) {
      const k = kept[i]
      if (poi.distanceM - k.distanceM > namedM) break // nothing earlier can match
      const d = haversineMeters(poi.lat, poi.lng, k.lat, k.lng)
      if (name ? normalizedName(k) === name && d <= namedM : d <= unnamedM) {
        isDup = true
        break
      }
    }

    if (!isDup) kept.push(poi)
  }
  return kept
}

// How far past the absolute nearest hit a BETTER-LABELLED one may sit and still
// be headlined instead.
//
// Its own constant since 2026-08-11. It used to borrow the dedupe radius, which
// silently conflated two unrelated ideas — "these two rows are one place" and
// "this one is a better answer than that one" — and when dedupe went
// per-category this band would have started varying by category for no reason
// anyone intended. A hospital is not a better answer than a clinic next door
// because hospital campuses are large.
const PREFERENCE_BAND_M = 150

/**
 * The nearest result worth headlining, from a distance-sorted list.
 *
 * Two preferences, both confined to a 150 m band around the absolute nearest
 * so the answer never stops being "the nearest one" in any meaningful sense:
 *
 *   1. A NAMED place beats an anonymous point. "Apollo Pharmacy — 300 m" is
 *      both more useful and more checkable than "pharmacy — 200 m".
 *   2. A place from a preferred sub-category beats a lesser one. Modules that
 *      merge categories ask for this: lifestyle's "Healthcare" spans hospitals
 *      and clinics, and a hospital 450 m away is a better answer to that
 *      question than a single doctor's office at 430 m.
 *
 * Outside the band the raw nearest still wins — a hospital 2 km away is not a
 * better answer than a clinic next door, whatever it says on the building.
 *
 * @param {Array} hits  distance-sorted
 * @param {{prefer?: string[]}} [opts]  category keys, best first
 */
export function pickNearest(hits, { prefer } = {}) {
  if (!hits?.length) return null
  const nearest = hits[0]
  const band = nearest.distanceM + PREFERENCE_BAND_M
  const inBand = hits.filter((h) => h.distanceM <= band)
  if (inBand.length === 1) return nearest

  const rank = (h) => {
    const tier = prefer?.length ? prefer.indexOf(h.category) : -1
    return {
      // Unranked categories sort after ranked ones rather than before.
      tier: tier === -1 ? Number.MAX_SAFE_INTEGER : tier,
      named: h.name ? 0 : 1,
    }
  }

  return inBand.reduce((best, h) => {
    const a = rank(h)
    const b = rank(best)
    if (a.tier !== b.tier) return a.tier < b.tier ? h : best
    if (a.named !== b.named) return a.named < b.named ? h : best
    return h.distanceM < best.distanceM ? h : best
  }, nearest)
}

/**
 * POIs within a radius, grouped by category.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusM
 * @param {string[]} categories
 * @param {string} city  used only to tell "not seeded" from "nothing here"
 * @returns {Promise<{
 *   available: boolean,
 *   byCategory: Record<string, Array<{name, distanceM, lat, lng}>>,
 *   total: number,
 *   truncated: boolean,
 *   sparselyMapped: boolean,
 *   fetchedAt: string|null,
 * }>}
 */
export async function poisNear(lat, lng, radiusM, categories, city) {
  const empty = { available: false, byCategory: {}, total: 0, truncated: false, sparselyMapped: false, fetchedAt: null }

  const coverage = await poiCoverage(city)
  if (coverage === 0) return empty

  // Bounding box first — this is what the composite index serves. The box is
  // a square around a circle, so it over-selects at the corners; the haversine
  // pass below trims it to a true radius.
  const dLat = radiusM / DEG_LAT_M
  const dLng = radiusM / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180))

  try {
    const { rows, truncated } = await bboxScan(
      {
        ...SERVING,
        category: { in: categories },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      { category: true, name: true, brand: true, lat: true, lng: true }
    )

    const byCategory = {}
    for (const row of rows) {
      const pLat = Number(row.lat)
      const pLng = Number(row.lng)
      const distanceM = Math.round(haversineMeters(lat, lng, pLat, pLng))
      if (distanceM > radiusM) continue // trim the bbox corners
      // `category` travels on the item too, not just as the map key: modules
      // that merge categories (lifestyle's Healthcare = hospital + clinic)
      // flatten these lists and would otherwise lose which one a hit came
      // from — which is what pickNearest needs to prefer a hospital over a
      // doctors' office at comparable distance.
      ;(byCategory[row.category] ??= []).push({
        name: row.name, brand: row.brand, category: row.category, distanceM, lat: pLat, lng: pLng,
      })
    }

    let total = 0
    for (const [cat, list] of Object.entries(byCategory)) {
      list.sort((a, b) => a.distanceM - b.distanceM)
      byCategory[cat] = dedupeCategory(list, cat)
      total += byCategory[cat].length
    }

    return {
      available: true,
      byCategory,
      total,
      truncated,
      sparselyMapped: !truncated && total < sparseThreshold(radiusM),
      fetchedAt: await poiFreshness(city),
    }
  } catch (err) {
    intelError('spatial.poi_query_failed', err, { city })
    return empty
  }
}

// A browseable list is for reading, not exhausting — beyond this many rows a
// person searches, and search filters the full bbox result before the cap.
const LIST_LIMIT = 100

/**
 * The named POIs behind a category's count — what "18 grocery stores nearby"
 * actually is, one row per place, nearest first.
 *
 * Powers GET /api/v1/spatial/pois. Everything here is owned data (PoiIndex),
 * so a call costs one indexed bbox scan — nothing is metered, which is why
 * this can afford to exist as a browse/search surface at all.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string[]} categories  validated against CATEGORY_KEYS by the caller
 * @param {number} radiusM
 * @param {string} city  used only to tell "not seeded" from "nothing here"
 * @returns {Promise<{
 *   available: boolean,
 *   total: number,
 *   truncated: boolean,
 *   pois: Array<{name, brand, openingHours, category, lat, lng, distanceM}>,
 * }>}
 */
export async function listPoisNear(lat, lng, categories, radiusM, city) {
  const empty = { available: false, total: 0, truncated: false, pois: [] }

  const coverage = await poiCoverage(city)
  if (coverage === 0) return empty

  const dLat = radiusM / DEG_LAT_M
  const dLng = radiusM / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180))

  try {
    const { rows, truncated } = await bboxScan(
      {
        ...SERVING,
        category: { in: categories },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      {
        category: true, name: true, brand: true, openingHours: true,
        lat: true, lng: true,
      }
    )

    const byCategory = {}
    for (const row of rows) {
      const pLat = Number(row.lat)
      const pLng = Number(row.lng)
      const distanceM = Math.round(haversineMeters(lat, lng, pLat, pLng))
      if (distanceM > radiusM) continue
      ;(byCategory[row.category] ??= []).push({
        name: row.name,
        brand: row.brand,
        openingHours: row.openingHours,
        category: row.category,
        lat: pLat,
        lng: pLng,
        distanceM,
      })
    }

    const pois = []
    // entries, not values — dedupeCategory needs the category to pick the right
    // footprint, and these rows carry it, but reading it from the KEY is what
    // keeps this correct if a row ever arrives without the field.
    for (const [cat, list] of Object.entries(byCategory)) {
      list.sort((a, b) => a.distanceM - b.distanceM)
      pois.push(...dedupeCategory(list, cat))
    }
    pois.sort((a, b) => a.distanceM - b.distanceM)

    return {
      available: true,
      total: pois.length,
      truncated: truncated || pois.length > LIST_LIMIT,
      pois: pois.slice(0, LIST_LIMIT),
    }
  } catch (err) {
    intelError('spatial.poi_list_failed', err, { city })
    return empty
  }
}

/**
 * City-wide row count per category — cached hard, changes only on re-seed.
 *
 * Exists to tell two zeroes apart. Every Indian city has police stations, so a
 * city whose PoiIndex holds zero rows in the `police` category was seeded
 * before that category joined the vocabulary — the honest reading is "not
 * loaded yet", not "none nearby". A module must check this before rendering
 * "none mapped within 2 km" for a category that postdates the city's seed.
 *
 * @returns {Promise<Record<string, number>>} category → city-wide count
 */
export async function cityCategoryCoverage(city) {
  if (!city) return {}
  const key = `spatial:poicat:${city}`
  const cached = await cacheGet(key)
  if (cached?.v) return cached.v

  try {
    const rows = await prisma.poiIndex.groupBy({
      by: ['category'],
      where: { ...SERVING, city },
      _count: { _all: true },
    })
    const coverage = Object.fromEntries(rows.map((r) => [r.category, r._count._all]))
    // Wrapped in { v } — cacheGet collapses "miss" and "stored null" otherwise.
    await cacheSet(key, { v: coverage }, COVERAGE_TTL_S)
    return coverage
  } catch (err) {
    intelError('spatial.poi_category_coverage_failed', err, { city })
    return {}
  }
}

export const OSM_POI_SOURCE = { name: 'OpenStreetMap', license: 'ODbL', fetchedAt: null }

/** The `source` string modules stamp on facts that came from PoiIndex. */
export const OSM_POI_SOURCE_ID = 'osm-poi'

/**
 * Confidence factors arising from how this city's POI table was BUILT, as
 * opposed to what it contains.
 *
 * Input availability already asks "did this module get a POI table". It cannot
 * ask "was that table complete", because a half-failed fetch and a clean one
 * produce the same shape — just fewer rows, which reads downstream as a genuinely
 * quiet neighbourhood. That distinction is the entire reason DataQualityReport
 * exists, and until now nothing consumed it.
 *
 * Empty on the Google fallback path: our ETL coverage says nothing about a
 * result we didn't fetch ourselves.
 *
 * @param {string} sourceId  the module's resolved data source
 * @param {string|null} city
 * @returns {Promise<Array>} zero or one factor, ready for `confidenceFactors`
 */
export async function poiConfidenceFactors(sourceId, city) {
  if (sourceId !== OSM_POI_SOURCE_ID || !city) return []

  // Both read cached/indexed values, so this costs the read path nothing
  // meaningful, and they answer genuinely different questions: coverage is
  // "did the fetch finish", freshness is "how long ago was it".
  const [coverage, fetchedAt] = await Promise.all([
    coverageFactor('poi_index', city),
    poiFreshness(city),
  ])

  // Order matters only for reporting: coverage caps, freshness scales, and
  // computeConfidence applies them in sequence. Listing the cap first means a
  // capped score isn't then reported as having been scaled from a number it
  // never held.
  return [coverage, freshnessFactor(fetchedAt)].filter(Boolean)
}
