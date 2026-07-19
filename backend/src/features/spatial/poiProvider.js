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

// Below this many POIs within the search radius, in a city we know IS seeded,
// the area is more likely under-mapped than genuinely empty. That distinction
// is the whole reason this threshold exists: OSM coverage in India varies
// enormously between and within cities, and "no shops" versus "nobody mapped
// the shops" are different claims.
const SPARSE_MAPPING_THRESHOLD = 12

// Whether a city has been seeded at all changes only when someone re-runs the
// ingestion script, so this can be cached hard.
const COVERAGE_TTL_S = 60 * 60

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
 * POIs within a radius, grouped by category.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusM
 * @param {string[]} categories
 * @param {string} city  used only to tell "not seeded" from "nothing here"
 * @returns {Promise<{
 *   available: boolean,
 *   byCategory: Record<string, Array<{name: string|null, distanceM: number}>>,
 *   total: number,
 *   sparselyMapped: boolean,
 * }>}
 */
export async function poisNear(lat, lng, radiusM, categories, city) {
  const empty = { available: false, byCategory: {}, total: 0, sparselyMapped: false }

  const coverage = await poiCoverage(city)
  if (coverage === 0) return empty

  // Bounding box first — this is what the composite index serves. The box is
  // a square around a circle, so it over-selects at the corners; the haversine
  // pass below trims it to a true radius.
  const dLat = radiusM / DEG_LAT_M
  const dLng = radiusM / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180))

  try {
    const rows = await prisma.poiIndex.findMany({
      where: {
        category: { in: categories },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      select: { category: true, name: true, lat: true, lng: true },
      // A cell with thousands of restaurants in range doesn't need all of
      // them to answer "how far is the nearest, and how many are there" —
      // but the cap must be high enough that the count stays honest.
      take: 2000,
    })

    const byCategory = {}
    let total = 0

    for (const row of rows) {
      const distanceM = Math.round(haversineMeters(lat, lng, Number(row.lat), Number(row.lng)))
      if (distanceM > radiusM) continue // trim the bbox corners
      ;(byCategory[row.category] ??= []).push({ name: row.name, distanceM })
      total++
    }

    for (const list of Object.values(byCategory)) list.sort((a, b) => a.distanceM - b.distanceM)

    return {
      available: true,
      byCategory,
      total,
      sparselyMapped: total < SPARSE_MAPPING_THRESHOLD,
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
    const rows = await prisma.poiIndex.findMany({
      where: {
        category: { in: categories },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      select: {
        category: true, name: true, brand: true, openingHours: true,
        lat: true, lng: true,
      },
      take: 2000,
    })

    const pois = []
    for (const row of rows) {
      const distanceM = Math.round(haversineMeters(lat, lng, Number(row.lat), Number(row.lng)))
      if (distanceM > radiusM) continue
      pois.push({
        name: row.name,
        brand: row.brand,
        openingHours: row.openingHours,
        category: row.category,
        lat: Number(row.lat),
        lng: Number(row.lng),
        distanceM,
      })
    }
    pois.sort((a, b) => a.distanceM - b.distanceM)

    return {
      available: true,
      total: pois.length,
      truncated: pois.length > LIST_LIMIT,
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
