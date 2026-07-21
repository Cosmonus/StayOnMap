// Walk-time returns to cards — as a MEASUREMENT, never an assumption.
//
// The assumed version ("about a 6 min walk" = haversine × 1.35 detour ÷
// 4.8 km/h pace) was removed 2026-07-20 because a straight line across a rail
// line is fiction. This module is the return path the removal note promised:
// when the self-hosted router (routingProvider.js) is up, distance facts gain
// a network-walked time from THE PROPERTY'S OWN position — read-time, like
// reanchor.js, so a listing at a cell edge gets its own walk, not the
// centroid's.
//
// Honesty mechanics:
//   - Router absent/down → facts pass through untouched. Cards look exactly
//     as they do today. No fact ever carries an assumed walk time.
//   - The walk figure is attached as a separate `walk` field with its own
//     provenance (MEASURED — it is a routed path over real streets), leaving
//     the fact's original haversine value DERIVED, as the accuracy pass
//     labelled it. The two are different claims and stay separately labelled.
//   - A POI the router cannot snap to the network keeps its fact unchanged.
import { routingAvailable, walkTable } from './routingProvider.js'
import { intelError } from '../../lib/intelLog.js'

// One /table call per read, so cap how many facts we enrich — a property page
// shows a handful of nearest-POI facts, not fifty.
const MAX_TARGETS = 24

const isEnrichable = (f) =>
  f && f.unit === 'm' && f.at && typeof f.at.lat === 'number' && typeof f.at.lng === 'number'

function withWalk(fact, hit) {
  if (!hit) return fact
  const minutes = Math.max(1, Math.round(hit.walkSeconds / 60))
  return {
    ...fact,
    walk: {
      meters: hit.walkM,
      minutes,
      provenance: 'MEASURED',
      method: 'walking route over the OpenStreetMap street network (self-hosted OSRM)',
    },
    display: `${fact.display} · about ${minutes} min walk`,
  }
}

/**
 * Enrich every distance fact in a modules payload with a measured walk time
 * from (lat, lng). Pure with respect to its input — returns new objects,
 * never mutates the cached envelopes. Returns the input unchanged whenever
 * the router has nothing to say.
 */
export async function enrichWithWalkTimes(modules, lat, lng, fetchImpl = fetch) {
  if (!modules || typeof lat !== 'number' || typeof lng !== 'number') return modules
  if (!(await routingAvailable(fetchImpl))) return modules

  // Collect enrichable facts across all envelopes, remembering where each
  // one lives so results map back without guessing.
  const slots = []
  for (const [moduleKey, env] of Object.entries(modules)) {
    env?.facts?.forEach((f, i) => {
      if (isEnrichable(f) && slots.length < MAX_TARGETS) slots.push({ moduleKey, i, fact: f })
    })
  }
  if (!slots.length) return modules

  try {
    const hits = await walkTable({ lat, lng }, slots.map((s) => ({ lat: s.fact.at.lat, lng: s.fact.at.lng })), fetchImpl)
    if (!hits) return modules

    const out = { ...modules }
    slots.forEach((s, n) => {
      const enriched = withWalk(s.fact, hits[n])
      if (enriched === s.fact) return
      if (out[s.moduleKey] === modules[s.moduleKey]) {
        out[s.moduleKey] = { ...modules[s.moduleKey], facts: [...modules[s.moduleKey].facts] }
      }
      out[s.moduleKey].facts[s.i] = enriched
    })
    return out
  } catch (err) {
    intelError('spatial.walk_enrich_failed', err, {})
    return modules
  }
}
