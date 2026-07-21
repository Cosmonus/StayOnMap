// Self-hosted OSRM client — measured walking distances over real streets.
//
// The provider contract every spatial source in this codebase follows:
// ABSENT IS A SUPPORTED STATE. No ROUTING_URL, or the router down, means every
// function here returns null and callers keep the haversine behaviour they
// have today — the router can only improve a number, never break a page.
// That is also why nothing retries aggressively: a routing call sits inside
// cell materialisation, and a hung router must not become a hung cell.
//
// Why /table and not N× /route: one origin (a cell or property) against many
// POI destinations is OSRM's table case — one HTTP round-trip for the whole
// set. `sources=0` pins the origin as the only source row.
import { env } from '../../config/env.js'
import { intelError } from '../../lib/intelLog.js'

const TIMEOUT_MS = 4000

// Health state is memoised for a short window so a dead router costs one
// failed probe per interval, not one per materialisation.
const HEALTH_TTL_MS = 60_000
let health = { ok: false, checkedAt: 0 }

export function resetRoutingHealth() {
  health = { ok: false, checkedAt: 0 }
}

export function routingConfigured() {
  return Boolean(env.routingUrl)
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Is the router configured AND answering? Cached for a minute either way. */
export async function routingAvailable(fetchImpl = fetch) {
  if (!routingConfigured()) return false
  if (Date.now() - health.checkedAt < HEALTH_TTL_MS) return health.ok

  // A real (tiny) route request, not just a TCP connect — an OSRM container
  // that is up but still loading its graph answers the port and fails routes.
  const probe = `${env.routingUrl}/route/v1/foot/77.5946,12.9716;77.5956,12.9726?overview=false`
  let ok = false
  try {
    const body = await fetchJson(probe, fetchImpl)
    ok = body?.code === 'Ok'
  } catch { /* down = not ok */ }

  health = { ok, checkedAt: Date.now() }
  return ok
}

/**
 * Measured walking distance/duration from ONE origin to MANY destinations.
 *
 * @param {{lat: number, lng: number}} from
 * @param {Array<{lat: number, lng: number}>} tos
 * @returns {Promise<Array<{walkM: number, walkSeconds: number}|null>|null>}
 *   null when the router is absent/down/errored (callers keep haversine);
 *   per-destination null when OSRM cannot snap that destination to the
 *   network (a POI inside a lake, a gated campus centroid).
 */
export async function walkTable(from, tos, fetchImpl = fetch) {
  if (!tos?.length) return []
  if (!(await routingAvailable(fetchImpl))) return null

  const coords = [from, ...tos].map((p) => `${p.lng},${p.lat}`).join(';')
  const url = `${env.routingUrl}/table/v1/foot/${coords}?sources=0&annotations=distance,duration`

  try {
    const body = await fetchJson(url, fetchImpl)
    if (body?.code !== 'Ok' || !body.distances?.[0] || !body.durations?.[0]) return null

    // Row 0 is our single source; column 0 is the origin itself — skip it.
    return tos.map((_, i) => {
      const distance = body.distances[0][i + 1]
      const duration = body.durations[0][i + 1]
      if (distance == null || duration == null) return null
      return { walkM: Math.round(distance), walkSeconds: Math.round(duration) }
    })
  } catch (err) {
    // One failure flips the health cache so the next minute of
    // materialisations skips the router instead of timing out one by one.
    health = { ok: false, checkedAt: Date.now() }
    intelError('spatial.routing_table_failed', err, { destinations: tos.length })
    return null
  }
}
