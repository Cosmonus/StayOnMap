// "Within N metres of a metro" — the read half of the spatial proximity index.
//
// Kept out of filters.registry.js on purpose. Every filter there produces its
// Prisma fragment SYNCHRONOUSLY from the query value; this one has to ask the
// database which cells qualify first. Forcing it into that contract would mean
// making `buildFilterWhere` async and touching every caller, to accommodate one
// filter that is genuinely a different shape.
//
// The honesty problem this file exists to solve
// ---------------------------------------------
// Three outcomes look identical to someone reading a filtered result list:
//
//   1. metro within the radius        → included, correct
//   2. metro genuinely further away   → excluded, correct
//   3. NO MAP DATA for that cell      → excluded, and nobody is told
//
// The third silently removes an owner's listing from results. It is the same
// absence-vs-ignorance confusion the whole spatial layer exists to prevent,
// except in the one place a user can see no caveat at all — a filtered list has
// nowhere to put a provenance chip.
//
// So the resolver reports `unknown`: how many listings were set aside because we
// could not judge them, rather than because we judged them and they failed. The
// caller surfaces that ("3 homes hidden — no map data for their area yet").
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { cellsNear } from '../spatial/proximityIndex.js'
import { intelError } from '../../lib/intelLog.js'

// The radii the UI offers. Bounded rather than free-form: an arbitrary metre
// value invites a precision the underlying distance does not have — these are
// straight-line, not walking, distances.
//
// Deliberately labelled in DISTANCE, never in minutes. A "15 minute walk" label
// would reintroduce exactly the assumption removed from proximity.js: the
// number behind it is a straight line, and calling it a walking time is a guess
// wearing a measurement's voice.
export const PROXIMITY_RADII = [800, 1500, 3000]

/**
 * Proximity filters, keyed by query param.
 *
 * Only metro today. Adding `nearSchool` or `nearHospital` is one line each — the
 * category must be in FILTERABLE_POI_CATEGORIES so the index actually holds it.
 * Shipping one filter well beats shipping seven empty states badly.
 */
export const PROXIMITY_FILTERS = {
  nearMetro: { category: 'metro_station', label: 'metro station' },
}

/**
 * The active proximity params, for a cache key.
 *
 * `filterCacheKey` walks the FILTERS registry, and these deliberately are not in
 * it — so without this, `nearMetro=800` and `nearMetro=3000` would share a
 * cached pin set and serve each other's results. A filter that is invisible to
 * the cache key is worse than no filter.
 */
export function proximityCacheKey(query) {
  const active = {}
  for (const id of Object.keys(PROXIMITY_FILTERS).sort()) {
    if (query?.[id] != null) active[id] = query[id]
  }
  return JSON.stringify(active)
}

/** Query-schema fragment, merged into the list/pins/count schemas. */
export const proximitySchema = Object.fromEntries(
  Object.keys(PROXIMITY_FILTERS).map((id) => [
    id,
    z.coerce.number().int().refine((v) => PROXIMITY_RADII.includes(v), {
      message: `must be one of ${PROXIMITY_RADII.join(', ')} metres`,
    }).optional(),
  ])
)

/**
 * Resolve any active proximity filter into a geohash constraint.
 *
 * @returns {Promise<{where: object, unknown: number, truncated: boolean, label: string}|null>}
 *          null when no proximity filter is active — the common case, and it
 *          must cost nothing.
 */
export async function resolveProximityFilter(query, baseWhere = {}) {
  const active = Object.entries(PROXIMITY_FILTERS)
    .map(([id, def]) => ({ id, def, metres: query?.[id] }))
    .filter((f) => f.metres != null)

  if (!active.length) return null

  try {
    // One filter today; if several are ever active at once, a listing must
    // satisfy ALL of them, so the geohash sets intersect.
    let geohashes = null
    for (const { def, metres } of active) {
      const { geohashes: cells } = await cellsNear(def.category, metres)
      geohashes = geohashes === null
        ? cells
        : geohashes.filter((g) => cells.includes(g))
    }

    // Count what we could NOT judge, so the caller can say so.
    const unknown = await countUnjudged(baseWhere, active)

    return {
      where: { geohash: { in: geohashes } },
      unknown,
      truncated: false,
      label: active.map(({ def, metres }) => `${describeRadius(metres)} of a ${def.label}`).join(' and '),
    }
  } catch (err) {
    // A filter that cannot be resolved must not silently return everything —
    // that would show listings nowhere near a metro under a "near metro"
    // heading. Returning null makes the caller drop the filter and say so.
    intelError('properties.proximity_filter_failed', err, { query })
    return null
  }
}

/**
 * Listings this filter could not judge either way.
 *
 * Two populations, and the second is the larger one:
 *   - `geohash: null` — never placed in a cell (un-backfilled, or no coords)
 *   - in a cell that has no summary row for this category — the city was never
 *     seeded for it, so it was never MEASURED, which is not the same as "far"
 *
 * Counted as (all matching) − (matching AND in a measured cell) rather than
 * with a `notIn` over the measured set: that set is one row per cell per
 * category and runs to tens of thousands in a large city, and a `notIn` of that
 * size is a slow query pretending to be a safety check. Two indexed counts cost
 * the same at any scale.
 */
async function countUnjudged(baseWhere, active) {
  const measured = await measuredCells(active[0].def.category)
  if (!measured.length) {
    // Nothing measured at all — every listing is unjudged, and the filter is
    // about to return zero results. Saying so is the whole point.
    return prisma.property.count({ where: baseWhere })
  }

  const [all, judged] = await Promise.all([
    prisma.property.count({ where: baseWhere }),
    prisma.property.count({ where: { ...baseWhere, geohash: { in: measured } } }),
  ])
  return all - judged
}

/** Cells carrying a summary row for this category — measured, at any distance. */
async function measuredCells(category) {
  const rows = await prisma.cellPoiSummary.findMany({
    where: { category },
    select: { geohash: true },
  })
  return rows.map((r) => r.geohash)
}

/** "800 m" / "1.5 km" — distance, never a duration. */
export function describeRadius(metres) {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`
}
