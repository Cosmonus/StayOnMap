// Read-time re-anchoring — the fix for the cell-centroid distance error.
//
// Facts are computed once per geohash-7 CELL (~153 m across) from the cell's
// centre, which keeps the layer cheap: 400 flats in one cell share one
// computation. But a property can sit up to ~108 m from that centre, so a
// stored "420 m to the pharmacy" could be anywhere from ~312 m to ~528 m from
// the actual door — and two listings at opposite ends of a cell showed
// byte-identical numbers.
//
// The resolution is not smaller cells (16× the materialisation cost) — it is
// carrying the target's coordinates on the fact (`at`, set by modules from
// OSM/owned data) and re-deriving the distance from the PROPERTY's own
// position at read time. Pure arithmetic per fact, no query, no API call; the
// cell stays the cache key. Counts stay cell-anchored — re-counting would need
// a query — which their `withinM` display keeps honest to within a cell width.
//
// Facts without `at` (counts, ratios, Google-fallback facts, air quality) pass
// through untouched.
import { haversineMeters } from '../../lib/geohash.js'
import { walkDisplay, walkMinutes, formatDistance } from './proximity.js'

function rebuildDisplay(f, meters) {
  const dist = f.displayStyle === 'distance' ? formatDistance(meters) : walkDisplay(meters)
  const head = f.place ? `${f.place} — ${dist}` : dist
  return f.count != null && f.withinM != null
    ? `${head} · ${f.count} within ${formatDistance(f.withinM)}`
    : head
}

/**
 * Re-derive one fact's value and display from the reader's true position.
 * Returns the fact unchanged when it carries no target coordinates.
 */
export function reanchorFact(f, lat, lng) {
  if (!f?.at || typeof f.at.lat !== 'number' || typeof f.at.lng !== 'number') return f
  const meters = Math.round(haversineMeters(lat, lng, f.at.lat, f.at.lng))

  if (f.unit === 'min') {
    const min = walkMinutes(meters)
    return { ...f, value: min, display: `about ${min} min on foot` }
  }
  if (f.unit !== 'm') return f

  return { ...f, value: meters, display: rebuildDisplay(f, meters) }
}

/**
 * Re-anchor every module envelope in a cell's payload to a specific
 * coordinate. Pure — never mutates the stored/cached objects.
 *
 * @param {Record<string, object>|null} modules  as returned by getContext
 * @param {number} lat  the property's (or requested) latitude
 * @param {number} lng
 */
export function reanchorModules(modules, lat, lng) {
  if (!modules || typeof lat !== 'number' || typeof lng !== 'number') return modules
  return Object.fromEntries(
    Object.entries(modules).map(([key, env]) => [
      key,
      env?.facts?.length
        ? { ...env, facts: env.facts.map((f) => reanchorFact(f, lat, lng)) }
        : env,
    ])
  )
}
