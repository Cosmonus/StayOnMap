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
//   - same category + same normalised name/brand within this range → one place
//   - an unnamed row this close to an already-kept same-category row is
//     almost always the node/way double of it, not a second real place
const DUP_NAMED_M = 150
const DUP_UNNAMED_M = 30

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
    const count = await prisma.poiIndex.count({ where: { city } })
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
    const agg = await prisma.poiIndex.aggregate({ where: { city }, _max: { fetchedAt: true } })
    const iso = agg._max.fetchedAt ? agg._max.fetchedAt.toISOString().slice(0, 10) : null
    // Wrapped in { v } — cacheGet collapses "miss" and "stored null" otherwise.
    await cacheSet(key, { v: iso }, COVERAGE_TTL_S)
    return iso
  } catch (err) {
    intelError('spatial.poi_freshness_failed', err, { city })
    return null
  }
}

/** The OSM source line for envelopes, with the city's real fetch date on it. */
export async function osmSourceMeta(city) {
  return { ...OSM_POI_SOURCE, fetchedAt: await poiFreshness(city) }
}

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
 */
export function dedupeCategory(sorted) {
  const kept = []
  for (const poi of sorted) {
    const name = normalizedName(poi)
    const isDup = kept.some((k) => {
      const d = haversineMeters(poi.lat, poi.lng, k.lat, k.lng)
      if (name && normalizedName(k) === name) return d <= DUP_NAMED_M
      if (!name) return d <= DUP_UNNAMED_M
      return false
    })
    if (!isDup) kept.push(poi)
  }
  return kept
}

/**
 * The nearest result worth headlining. An unnamed OSM point is still real,
 * but when a named place sits almost as close, naming it is both more useful
 * and more checkable — so a named hit within 150 m of the absolute nearest
 * wins the "nearest X" slot. Never skips more than that: the raw nearest is
 * the honest answer when nothing named is comparably close.
 */
export function pickNearest(hits) {
  if (!hits?.length) return null
  const nearest = hits[0]
  if (nearest.name) return nearest
  const named = hits.find((h) => h.name && h.distanceM <= nearest.distanceM + DUP_NAMED_M)
  return named ?? nearest
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
      ;(byCategory[row.category] ??= []).push({ name: row.name, brand: row.brand, distanceM, lat: pLat, lng: pLng })
    }

    let total = 0
    for (const [cat, list] of Object.entries(byCategory)) {
      list.sort((a, b) => a.distanceM - b.distanceM)
      byCategory[cat] = dedupeCategory(list)
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
    for (const list of Object.values(byCategory)) {
      list.sort((a, b) => a.distanceM - b.distanceM)
      pois.push(...dedupeCategory(list))
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
      where: { city },
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
