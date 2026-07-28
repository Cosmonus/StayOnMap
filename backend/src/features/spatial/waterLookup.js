// How far is the nearest water, and what is it called?
//
// Boundary asks "which polygon contains this point" — an exact question a bbox
// containment scan answers directly. This asks "which polygon is CLOSEST",
// which a bbox cannot answer on its own: the nearest body by edge distance is
// not necessarily the one with the nearest bbox. So the bbox scan here is a
// candidate generator over a search radius, and JS decides. Same no-PostGIS
// pattern, one step harder — see docs/spatial-intelligence.md §3.
//
// ⚠ THIS IS NOT A FLOOD SIGNAL. Distance to water is the most tempting flood
// proxy available and the platform's standing refusal covers it: whether water
// collects somewhere depends on drains, pumps and upstream construction, none
// of which is published. Nothing in this file may return a hazard, a risk level
// or a probability, and tests/spatial-water.test.js enforces that.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'

// Water moves on geological time; reservoirs get built on municipal time. The
// cache is here to spare re-decoding large river polygons, not to track change.
const LOOKUP_TTL_S = 24 * 60 * 60

// Beyond this, "the nearest water" stops being a fact about this address. A
// 3 km lake is not a feature of your street.
export const SEARCH_RADIUS_M = 3000

// Below this, a mapped polygon is a drain, a fountain or a swimming pool that
// somebody tagged as water. Reporting one as "your nearest lake" is worse than
// reporting nothing. 2000 m² is roughly a 45 m square.
export const MIN_AREA_SQM = 2000

const DEG_LAT_M = 111_320

// Plain-language names for our own `kind` vocabulary. The seeder maps OSM's
// much larger tag set down to these six; anything it cannot place is dropped
// rather than guessed.
export const WATER_KIND_LABELS = {
  lake: 'lake',
  river: 'river',
  reservoir: 'reservoir',
  tank: 'tank',
  pond: 'pond',
  canal: 'canal',
}

/**
 * Metres from a point to a line segment, on a locally-flat approximation.
 *
 * Equirectangular rather than great-circle: over the <3 km spans this is used
 * for, the error is far below the metre, and the alternative is projecting
 * every ring vertex of every candidate on every call.
 */
function pointToSegmentM(pt, a, b) {
  const mPerLng = DEG_LAT_M * Math.cos((pt.lat * Math.PI) / 180)
  const px = (pt.lng - a[0]) * mPerLng
  const py = (pt.lat - a[1]) * DEG_LAT_M
  const bx = (b[0] - a[0]) * mPerLng
  const by = (b[1] - a[1]) * DEG_LAT_M

  const lenSq = bx * bx + by * by
  // Degenerate segment (a duplicated vertex — common in OSM rings): fall back
  // to the endpoint distance rather than dividing by zero.
  if (lenSq === 0) return Math.hypot(px, py)

  // Clamped projection of the point onto the segment.
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq))
  return Math.hypot(px - t * bx, py - t * by)
}

/** Ray casting, on a GeoJSON ring in [lng, lat] order. */
function pointInRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const straddles = yi > pt.lat !== yj > pt.lat
    if (straddles && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Every ring of a Polygon or MultiPolygon, outer and inner alike. */
function ringsOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates ?? []
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates ?? []).flat()
  return []
}

/**
 * Distance from a point to a water polygon, and the closest point on it.
 *
 * Zero when the point is inside — a property standing on a lake edge and one
 * standing in the lake are both "at the water", and inventing a negative
 * distance would imply a depth we do not have.
 *
 * The returned `at` is what lets reanchor.js and the walk enrichment treat this
 * like every other distance fact: a real coordinate, not a centroid.
 */
export function distanceToGeometry(lat, lng, geometry) {
  const pt = { lat, lng }
  const rings = ringsOf(geometry)
  if (!rings.length) return null

  // Inner rings are holes, so containment must be an odd number of crossings
  // across all of them — which is exactly what toggling gives.
  let inside = false
  for (const ring of rings) if (pointInRing(pt, ring)) inside = !inside

  let best = Infinity
  let at = null
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const d = pointToSegmentM(pt, ring[i], ring[i + 1])
      if (d < best) {
        best = d
        at = { lat: ring[i][1], lng: ring[i][0] }
      }
    }
  }
  if (at === null) return null

  return { distanceM: inside ? 0 : Math.round(best), at, inside }
}

/**
 * The nearest meaningful water body to a point.
 *
 * Returns:
 *   - an object  — found one
 *   - `null`     — we could not look (no table, DB error). NOT "none nearby".
 *   - `{ available: true, body: null }` — we looked and there is none within
 *     SEARCH_RADIUS_M.
 *
 * That three-way split is the same one providers.js draws, and it exists so a
 * module can tell "no data" from "no water" — collapsing them would make an
 * unseeded city look like a desert.
 *
 * @returns {{available: boolean, body: null|{name, kind, label, distanceM, at, inside}}|null}
 */
export async function nearestWater(lat, lng, radiusM = SEARCH_RADIUS_M) {
  const key = `spatial:water:${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000},${radiusM}`
  const cached = await cacheGet(key)
  if (cached) return cached.v

  const dLat = radiusM / DEG_LAT_M
  const dLng = radiusM / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180))

  try {
    // bbox INTERSECTION, not containment: a body counts if any part of its box
    // reaches into the search box. Over-selects (a box is not a circle, and a
    // long river's box is mostly empty), which the exact pass below trims.
    const candidates = await prisma.waterBody.findMany({
      where: {
        minLat: { lte: lat + dLat }, maxLat: { gte: lat - dLat },
        minLng: { lte: lng + dLng }, maxLng: { gte: lng - dLng },
        OR: [{ areaSqM: null }, { areaSqM: { gte: MIN_AREA_SQM } }],
      },
      select: { name: true, kind: true, geometry: true, areaSqM: true },
      // A runaway guard, not an expected limit. A dense lake district might
      // return dozens; the cost here is JSON decoding, so cap it.
      take: 60,
    })

    if (!candidates.length) {
      const none = { available: true, body: null }
      await cacheSet(key, { v: none }, LOOKUP_TTL_S)
      return none
    }

    let best = null
    for (const c of candidates) {
      const hit = distanceToGeometry(lat, lng, c.geometry)
      if (!hit || hit.distanceM > radiusM) continue
      // Ties go to the larger body: standing between a lake and the drain that
      // feeds it, the lake is the answer a person expects.
      const better = !best || hit.distanceM < best.distanceM ||
        (hit.distanceM === best.distanceM && (c.areaSqM ?? 0) > (best.areaSqM ?? 0))
      if (better) {
        best = {
          name: c.name ?? null,
          kind: c.kind,
          label: WATER_KIND_LABELS[c.kind] ?? 'water',
          distanceM: hit.distanceM,
          at: hit.at,
          inside: hit.inside,
          areaSqM: c.areaSqM ?? null,
        }
      }
    }

    const result = { available: true, body: best }
    await cacheSet(key, { v: result }, LOOKUP_TTL_S)
    return result
  } catch (err) {
    // "Could not look" — deliberately distinct from "looked, found none".
    intelError('spatial.water_lookup_failed', err, {})
    return null
  }
}

/** Has this dataset been seeded at all? Used to keep an empty table honest. */
export async function waterCoverage(city) {
  try {
    return await prisma.waterBody.count({ where: city ? { city } : {} })
  } catch (err) {
    intelError('spatial.water_coverage_failed', err, {})
    return null
  }
}
