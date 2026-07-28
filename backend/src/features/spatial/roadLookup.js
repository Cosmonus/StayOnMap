// Can a vehicle actually get here, and over what?
//
// The `road_access` input landContext has declared and gone without since it
// was written — which is most of why it sits at 0.19 against a ceiling of 0.50,
// the weakest module in the layer.
//
// Two distances are reported, not one, and the difference between them IS the
// answer: the nearest road of ANY motorable class, and the nearest road a car
// can be driven on. When those are the same number the plot is on a street.
// When the first is 30 m and the second is 900 m, the last 900 m is a track —
// which is exactly the thing a plot buyer needs to be told and the thing a
// single "nearest road: 30 m" would hide.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'
import { distanceToLine, degreeBox } from './geometryDistance.js'
import { resolveCity } from '../../config/cityCenters.js'

const LOOKUP_TTL_S = 24 * 60 * 60

// Beyond this a road is not this plot's access, it is the region's.
export const SEARCH_RADIUS_M = 2000

/**
 * OSM's `highway=` values we carry, ranked by what they can carry.
 *
 * Rank is ours; the keys are OSM's, unmapped, for the reason the schema
 * comment gives. Higher is a bigger road. `track` sits at 0 deliberately: it is
 * motorable, which is why it is in the table at all, but calling it driveable
 * would be the whole lie this module exists to avoid.
 */
export const ROAD_CLASS_RANK = {
  motorway: 8, trunk: 7, primary: 6, secondary: 5, tertiary: 4,
  unclassified: 3, residential: 3, service: 2,
  motorway_link: 6, trunk_link: 5, primary_link: 5, secondary_link: 4, tertiary_link: 3,
  living_street: 3,
  track: 0,
}

// What "a car can use this" means here. `service` is included — a service road
// is tarmac and a delivery lorry uses one daily. `track` is not.
export const DRIVEABLE = Object.keys(ROAD_CLASS_RANK).filter((k) => k !== 'track')

export const ALL_MOTORABLE = Object.keys(ROAD_CLASS_RANK)

// Plain language, for display. Deliberately not a quality judgement — "primary
// road" says what OSM recorded, not that it is a good road.
export const ROAD_CLASS_LABELS = {
  motorway: 'expressway',
  trunk: 'highway',
  primary: 'main road',
  secondary: 'secondary road',
  tertiary: 'local main road',
  unclassified: 'public road',
  residential: 'residential street',
  service: 'service road',
  living_street: 'residential street',
  track: 'unsurfaced track',
  motorway_link: 'expressway slip road',
  trunk_link: 'highway slip road',
  primary_link: 'main road slip road',
  secondary_link: 'secondary road slip road',
  tertiary_link: 'local road slip road',
}

export const labelFor = (highway) => ROAD_CLASS_LABELS[highway] ?? 'road'

/** The closest of a candidate set, ties broken toward the bigger road. */
function pickNearest(lat, lng, rows, radiusM) {
  let best = null
  for (const r of rows) {
    const hit = distanceToLine(lat, lng, r.geometry)
    if (!hit || hit.distanceM > radiusM) continue
    const better = !best || hit.distanceM < best.distanceM ||
      (hit.distanceM === best.distanceM &&
        (ROAD_CLASS_RANK[r.highway] ?? 0) > (ROAD_CLASS_RANK[best.highway] ?? 0))
    if (better) {
      best = {
        name: r.name ?? null,
        highway: r.highway,
        label: labelFor(r.highway),
        widthM: r.widthM ?? null,
        // Tri-state on purpose: null means nobody recorded a surface, which is
        // NOT the same as unpaved and must never render as it.
        paved: r.paved ?? null,
        distanceM: hit.distanceM,
        at: hit.at,
      }
    }
  }
  return best
}

/**
 * Road access at a point.
 *
 * Returns:
 *   - `null` — we could not look (no table, DB error). NOT "no roads".
 *   - `{ available: true, nearest, driveable }` — we looked. Either field may
 *     be null, meaning "none of that kind within the radius".
 *
 * The same three-way contract waterLookup and providers.js use, and for the
 * same reason: an unseeded city must not render as roadless wilderness.
 */
export async function roadAccess(lat, lng, radiusM = SEARCH_RADIUS_M) {
  const key = `spatial:road:${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000},${radiusM}`
  const cached = await cacheGet(key)
  if (cached) return cached.v

  // Unseeded is "could not look", NEVER "there is no road here". Telling a plot
  // buyer their land has no road access because a seeder has not run yet is the
  // single most damaging thing this module could say.
  const city = resolveCity(lat, lng)?.city ?? null
  if ((await roadCoverage(city)) === 0) return null

  const { dLat, dLng } = degreeBox(lat, radiusM)

  try {
    // One scan, both answers. Fetching driveable separately would double the
    // query cost to re-read rows already in hand — the split is a filter over
    // the candidate set, not a second trip.
    const candidates = await prisma.roadSegment.findMany({
      where: {
        highway: { in: ALL_MOTORABLE },
        minLat: { lte: lat + dLat }, maxLat: { gte: lat - dLat },
        minLng: { lte: lng + dLng }, maxLng: { gte: lng - dLng },
      },
      select: { name: true, highway: true, widthM: true, paved: true, geometry: true },
      // Urban bboxes are dense. This is a runaway guard; the nearest road is
      // overwhelmingly within a few hundred metres, so a truncated candidate
      // set almost never changes the answer.
      take: 400,
    })

    const result = {
      available: true,
      nearest: pickNearest(lat, lng, candidates, radiusM),
      driveable: pickNearest(
        lat, lng,
        candidates.filter((r) => r.highway !== 'track'),
        radiusM
      ),
    }

    await cacheSet(key, { v: result }, LOOKUP_TTL_S)
    return result
  } catch (err) {
    intelError('spatial.road_lookup_failed', err, {})
    return null
  }
}


/**
 * Has this city's road data been seeded?
 *
 * THE most important guard in this file, and it was missing until 2026-07-28.
 * Without it an EMPTY table answers "we looked, there is none within range" —
 * which is a confident false statement, and worse, it counts the input as
 * PRESENT and raises the module's confidence on the basis of no data at all.
 * `poiProvider.js` has always gated on coverage this way; these lookups did
 * not, and would have shipped that to production.
 *
 * Cached, because the answer changes only when a seeder runs.
 */

export async function roadCoverage(city) {
  try {
    return await prisma.roadSegment.count({ where: city ? { city } : {} })
  } catch (err) {
    intelError('spatial.road_coverage_failed', err, {})
    return null
  }
}
