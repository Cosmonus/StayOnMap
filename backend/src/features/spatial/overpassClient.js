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
import { intelLog, intelError } from '../../lib/intelLog.js'

/** Public mirrors, tried in order. */
// Order is load-bearing: they are tried in sequence, so a slow mirror early in
// the list is paid for on every request that reaches it.
//
// Measured from the production VM 2026-07-28, after netTuning.js fixed the
// connection-attempt timeout that was making the first entry look dead:
//
//   overpass-api.de        HTTP 200 in  1.2 s
//   maps.mail.ru           HTTP 200 in 14.5 s
//   overpass.kumi.systems  hard timeout at 30 s
//
// kumi moved to LAST on that evidence. It used to sit second, where it was
// harmless only by accident: Node abandoned the connection after 250 ms, so it
// failed fast. With that bug fixed it would instead hang for the caller's FULL
// timeout — 240 s per tile in the seeders — before falling through. Fixing one
// thing made the ordering matter, which is why both changes ship together.
//
// It is kept rather than deleted: one measurement from one network is not
// proof a mirror is dead everywhere, and a third fallback costs nothing while
// the first two are healthy.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
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
  // Per-endpoint, not just the last one. `lastError` alone is always the FINAL
  // mirror's error, which on 2026-07-28 made a whole production run
  // undiagnosable: every log line blamed maps.mail.ru while the interesting
  // question — why the primary was skipped — went unrecorded.
  const attempts = []

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
        attempts.push({ endpoint, status: res.status })
        continue
      }

      // Worth a line in the log: a run that quietly succeeded on the third
      // mirror looks identical to a healthy one, and that is precisely the
      // signal that would tell us Overpass is no longer good enough for bulk.
      if (index > 0) {
        intelLog('spatial.overpass_fallback', {
          endpoint,
          skipped: index,
          // Why each skipped mirror was skipped. `code` separates a routing
          // problem (ENETUNREACH) from a block (ETIMEDOUT) from an overloaded
          // server (HTTP 504) — three different fixes that look identical as
          // "fetch failed".
          attempts,
          lastError: lastError?.message ?? null,
        })
      }

      return await res.json()
    } catch (err) {
      lastError = err
      attempts.push({
        endpoint,
        error: err.name,
        // undici wraps the real reason here; without it every network failure
        // is the useless string "fetch failed".
        code: err.cause?.code ?? err.code ?? null,
      })
    }
  }

  intelError('spatial.overpass_all_failed', lastError ?? new Error('all endpoints failed'), { attempts })
  throw lastError ?? new Error('all Overpass endpoints failed')
}
