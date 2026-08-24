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
//   - Remembers which mirror answered and tries it first next call. Without
//     this, a dead primary's timeout is paid once per tile for a whole seed
//     run (~144 tiles) instead of once per process.
//   - Reports which endpoint answered, so a caller can log a degraded run
//     rather than discover months later that the primary has been dead.
//   - Does NOT retry the same endpoint within a rotation. A tile that fails
//     everywhere is retried once by the caller, at the tile level, where the
//     failure is recorded as a coverage gap. Two retry mechanisms stacked
//     would multiply into a burst of load on a free service that was already
//     struggling.
//   - DOES sit out and retry the whole rotation when a mirror answered
//     429/504 (added 2026-08-24, from a run where it was the missing piece:
//     maps.mail.ru was the only reachable mirror from the VM, it 504'd after
//     one oversized central-Delhi tile, and every subsequent tile of a
//     47-city run failed instantly). "Busy" is a request to wait, and
//     failing 40 cities in a row is not lighter on the service than waiting
//     — the caller's retry pass and the next operator run repeat all of it.
//     The sit-out only triggers when some mirror said busy; when every
//     failure is a network error there is nothing to wait for.
//   - Puts a mirror that threw a NETWORK error on a short cooldown and skips
//     it while the cooldown runs (added 2026-08-24, later the same day: with
//     maps.mail.ru the only live mirror, every 504 → sit-out → retry cycle
//     re-paid the other two mirrors' connection timeouts before reaching the
//     mirror that was actually asking us to wait). HTTP errors never cool a
//     mirror down — a 504 is an ANSWER, the host is alive.
//   - Paces itself after a busy episode (added with the cooldown): a fixed
//     2 s between tiles is exactly the rate that made the one live mirror
//     504 city after city. Once a call hits the busy sit-out, the NEXT calls
//     open with a pause that doubles per episode and decays on clean
//     successes — the client-side half of "busy is a request to wait".
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

// How long a mirror that threw a network error is skipped. Two minutes, not
// ten: a mirror this process cannot reach tends to stay unreachable for the
// whole run (that is the sticky-preference lesson), but "tends to" is not
// "is" — the skip must expire so a recovered mirror is rediscovered without
// restarting a multi-hour seed. Only THROWN errors cool a mirror down; an
// HTTP status of any kind proves the host answered.
const NETWORK_COOLDOWN_MS = 120_000

// Adaptive pacing after a busy episode. Starts at 10 s, doubles per episode,
// caps at 60 s, halves on each clean success (dropping to zero below 2 s) —
// so a run relaxes back to full speed once the mirror stops complaining.
const POLITE_PAUSE_START_MS = 10_000
const POLITE_PAUSE_MAX_MS = 60_000

// The mirror that answered last, tried FIRST on the next call. A primary that
// is unreachable tends to stay unreachable for the whole run: the 2026-08-20
// prod POI seed paid overpass-api.de's connection timeout on every tile —
// ~144 of them across 9 cities — before falling back to the same working
// mirror each time. Process-lifetime state, no expiry: a recovered primary is
// picked up again on the next process (seeder runs are one process per run),
// and a preferred mirror that dies falls through to the others as normal.
let preferredEndpoint = null

// endpoint → epoch ms of its last THROWN network error. Read against the
// cooldown when building each round's order. Process-lifetime, self-expiring;
// a successful answer (or any HTTP status) clears the entry outright.
const networkFailAt = new Map()

// The opening pause the next call owes the service. Grows when a call hits
// the busy sit-out (or dies with a mirror still saying busy), decays on
// clean successes. Process-lifetime, like the preference.
let politePauseMs = 0

/** Test-only: forget all per-process state so test order cannot leak. */
export function _resetOverpassState() {
  preferredEndpoint = null
  politePauseMs = 0
  networkFailAt.clear()
}

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
    // Sit-outs between full rotations when a mirror answered 429/504.
    // Three waits ≈ 3.5 minutes worst case per tile — long for a human,
    // nothing against a failed 47-city run. Injectable for tests.
    busyBackoffMs = [30_000, 60_000, 120_000],
    sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    networkCooldownMs = NETWORK_COOLDOWN_MS,
  } = opts

  // The pause a previous call's busy episode left behind. Paid up front, once,
  // before the first request — this is what spaces a seed run out after the
  // only live mirror says it is struggling.
  if (politePauseMs > 0) await sleepImpl(politePauseMs)

  let lastError = null
  // Per-endpoint, not just the last one. `lastError` alone is always the FINAL
  // mirror's error, which on 2026-07-28 made a whole production run
  // undiagnosable: every log line blamed maps.mail.ru while the interesting
  // question — why the primary was skipped — went unrecorded.
  const attempts = []
  // Did this call ever hit the busy sit-out (or end with a mirror still
  // saying busy)? Decides whether the polite pause grows or decays on exit.
  let busyEpisode = false

  // Sticky preference reorders, never adds: it only applies when the caller's
  // list contains the remembered mirror, so injected test lists and any future
  // caller-specific list are unaffected by what another caller learned.
  const order = preferredEndpoint && endpoints.includes(preferredEndpoint)
    ? [preferredEndpoint, ...endpoints.filter((e) => e !== preferredEndpoint)]
    : endpoints

  for (let round = 0; ; round++) {
    const roundStart = attempts.length

    // Recomputed per ROUND, not per call: a mirror that ETIMEDOUT in round 1
    // must not be re-paid in round 2's post-sit-out retry — that retry exists
    // for the mirror that said "busy", which by definition answered. Skipped
    // mirrors are recorded in `attempts` so a log reader can still see WHY a
    // round went straight to one endpoint (the 2026-07-28 lesson).
    const now = Date.now()
    const live = order.filter((e) => {
      const failAt = networkFailAt.get(e)
      return failAt == null || now - failAt >= networkCooldownMs
    })
    for (const e of order) {
      if (!live.includes(e)) attempts.push({ endpoint: e, skipped: 'network-cooldown' })
    }
    // Never let the cooldown empty a round: a guess that every mirror is dead
    // must still be tested against reality, or the call fails on memory alone.
    const roundOrder = live.length ? live : order

    for (const [index, endpoint] of roundOrder.entries()) {
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
          // session. An HTTP answer of any kind also proves the host is alive,
          // so it clears a stale network cooldown rather than extending it.
          networkFailAt.delete(endpoint)
          lastError = new Error(`${endpoint} → HTTP ${res.status}`)
          attempts.push({ endpoint, status: res.status })
          continue
        }

        // Worth a line in the log: a run that quietly succeeded on the third
        // mirror looks identical to a healthy one, and that is precisely the
        // signal that would tell us Overpass is no longer good enough for bulk.
        // Cooldown skips alone don't qualify — entering cooldown was already
        // logged once, and repeating it per tile would be noise.
        if (attempts.some((a) => !a.skipped)) {
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

        // Remember who answered so the next call starts here instead of paying
        // a dead primary's timeout again. Logged only on a CHANGE — the switch
        // is the signal; repeating it per call would be the noise this exists
        // to remove.
        if (endpoint !== preferredEndpoint) {
          if (preferredEndpoint) {
            intelLog('spatial.overpass_preferred', { endpoint, previous: preferredEndpoint })
          }
          preferredEndpoint = endpoint
        }
        networkFailAt.delete(endpoint)

        // Pacing bookkeeping: a call that needed a busy sit-out grows the
        // opening pause for the NEXT calls; a clean success lets it decay.
        if (busyEpisode) {
          politePauseMs = politePauseMs
            ? Math.min(politePauseMs * 2, POLITE_PAUSE_MAX_MS)
            : POLITE_PAUSE_START_MS
          intelLog('spatial.overpass_pacing', { politePauseMs })
        } else {
          politePauseMs = politePauseMs >= 2_000 ? Math.floor(politePauseMs / 2) : 0
        }

        return await res.json()
      } catch (err) {
        lastError = err
        // A THROWN error means the host never answered — start (or refresh)
        // its cooldown so later rounds and calls stop paying its timeout.
        // Logged only on entering cooldown; refreshing one is not news.
        const already = networkFailAt.get(endpoint)
        if (already == null || Date.now() - already >= networkCooldownMs) {
          intelLog('spatial.overpass_cooldown', { endpoint, cooldownMs: networkCooldownMs })
        }
        networkFailAt.set(endpoint, Date.now())
        attempts.push({
          endpoint,
          error: err.name,
          // undici wraps the real reason here; without it every network failure
          // is the useless string "fetch failed".
          code: err.cause?.code ?? err.code ?? null,
        })
      }
    }

    // Every mirror failed this rotation. If one of them answered 429/504 it is
    // alive and asking for room — sit out and go around again. Pure network
    // failures get no wait: there is nothing on the other end to recover.
    const busy = attempts.slice(roundStart).some((a) => a.status === 429 || a.status === 504)
    if (busy) busyEpisode = true
    if (busy && round < busyBackoffMs.length) {
      const waitMs = busyBackoffMs[round]
      intelLog('spatial.overpass_busy_backoff', { waitMs, round: round + 1, attempts: attempts.slice(roundStart) })
      await sleepImpl(waitMs)
      continue
    }
    break
  }

  // A call that died while a mirror was still saying "busy" grows the pause
  // too — the caller's tile-level retry is about to repeat the question, and
  // asking it at full speed is how this failure was earned.
  if (busyEpisode) {
    politePauseMs = politePauseMs
      ? Math.min(politePauseMs * 2, POLITE_PAUSE_MAX_MS)
      : POLITE_PAUSE_START_MS
    intelLog('spatial.overpass_pacing', { politePauseMs })
  }

  intelError('spatial.overpass_all_failed', lastError ?? new Error('all endpoints failed'), { attempts })
  throw lastError ?? new Error('all Overpass endpoints failed')
}
