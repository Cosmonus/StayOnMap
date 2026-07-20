// The Overpass client the OSM seeders share.
//
// Both seeders had a byte-identical copy of this, differing only in a timeout
// and a user-agent string — the same duplication that produced the `--confirm`
// parsed-as-a-city bug in seedArgs.js. Worse here, because this is the code
// whose behaviour the entire "keep using Overpass instead of building a
// Geofabrik pipeline" decision rests on (docs/spatial-intelligence.md §4.4),
// and it had no tests on either copy.
//
// What it does, and what it deliberately does not:
//
//   - Rotates across mirrors on failure. Overpass is donated hardware; the main
//     endpoint has 406'd for an entire work session before (roadmap Addenda
//     10-11) while mirrors stayed up.
//   - Reports which endpoint answered, so a caller can log a degraded run
//     rather than discover months later that the primary has been dead.
//   - Does NOT retry the same endpoint. A tile that fails everywhere is
//     retried once by the caller, at the tile level, where the failure is
//     recorded as a coverage gap. Two retry mechanisms stacked would multiply
//     into a burst of load on a free service that was already struggling.
import { intelLog } from '../../lib/intelLog.js'

/** Public mirrors, tried in order. */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/**
 * POST a query, falling through the mirrors until one answers.
 *
 * @param {string} query  Overpass QL
 * @param {object} [opts]
 * @param {string} [opts.userAgent]  Overpass asks for an identifiable agent so
 *        it can contact abusers rather than silently blocking them. Name the
 *        specific seed, not just the app.
 * @param {number} [opts.timeoutMs]
 * @param {string[]} [opts.endpoints]  injectable for tests
 * @param {Function} [opts.fetchImpl]  injectable for tests
 * @returns {Promise<object>} the parsed JSON body
 * @throws the last error when every endpoint fails — callers treat that as a
 *         coverage gap, never as "this area has nothing"
 */
export async function overpassQuery(query, opts = {}) {
  const {
    userAgent = 'StayOnMap/1.0 (spatial intelligence seed; https://www.stayonmap.com)',
    timeoutMs = 180_000,
    endpoints = OVERPASS_ENDPOINTS,
    fetchImpl = fetch,
  } = opts

  let lastError = null

  for (const [index, endpoint] of endpoints.entries()) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!res.ok) {
        // `continue`, not `throw`: an HTTP error from one mirror is exactly the
        // case rotation exists for. 429 and 504 are Overpass's normal way of
        // saying "busy", and 406 is what the primary returned for a whole
        // session.
        lastError = new Error(`${endpoint} → HTTP ${res.status}`)
        continue
      }

      // Worth a line in the log: a run that quietly succeeded on the third
      // mirror looks identical to a healthy one, and that is precisely the
      // signal that would tell us Overpass is no longer good enough for bulk.
      if (index > 0) {
        intelLog('spatial.overpass_fallback', {
          endpoint,
          skipped: index,
          lastError: lastError?.message ?? null,
        })
      }

      return await res.json()
    } catch (err) {
      lastError = err
    }
  }

  throw lastError ?? new Error('all Overpass endpoints failed')
}
