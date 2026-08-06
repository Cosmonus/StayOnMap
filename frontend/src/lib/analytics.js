// Product telemetry, client side. First-party — this posts to our own API, not
// to a vendor, which is why the privacy policy can keep saying we use no
// third-party analytics and why there is no cookie banner to write.
//
// Three properties it has to have, because the alternative to each one is a
// number that misleads:
//   - Batched. One request per flush, not per event, so instrumenting the map
//     does not add a request to every pan.
//   - Session-scoped. `sessionStorage`, so the id dies with the tab. It exists
//     to stitch one visit's steps together and for nothing else — no
//     cross-visit identity, no localStorage, nothing that outlives the tab.
//   - Silent. A telemetry failure must be invisible to the user. Every path
//     here swallows its own errors.
import { api } from '@lib/api'

const KEY = 'sn_analytics_session'
const FLUSH_MS = 5000
const MAX_BATCH = 25

let queue = []
let timer = null

function sessionId() {
  try {
    let id = sessionStorage.getItem(KEY)
    if (!id) {
      id = `s_${crypto.randomUUID()}`
      sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Private mode, or storage disabled. A per-page-load id still makes the
    // events countable; it just cannot follow a navigation.
    return `s_ephemeral_${Math.random().toString(36).slice(2, 12)}`
  }
}

async function flush() {
  clearTimeout(timer)
  timer = null
  if (!queue.length) return

  const events = queue.slice(0, MAX_BATCH)
  queue = queue.slice(MAX_BATCH)

  try {
    await api.post('/api/v1/analytics/events', { events })
  } catch {
    // Dropped on purpose — no retry queue. Telemetry that retries forever
    // becomes a second source of load exactly when the API is already
    // struggling, and a lost sample is worth nothing next to that.
  }
}

/**
 * Record one funnel step. Fire-and-forget by design — never await this.
 *
 * @param name  one of the five funnel steps (backend features/analytics/events.js)
 * @param data  { propertyId?, city?, props? } — no personal data, ever. The
 *              server attaches the user id from the token when there is one.
 */
export function track(name, data = {}) {
  try {
    queue.push({ name, sessionId: sessionId(), ...data })
    if (queue.length >= MAX_BATCH) { flush(); return }
    timer ??= setTimeout(flush, FLUSH_MS)
  } catch { /* telemetry must never break a click */ }
}

/**
 * Some steps happen once per visit, not once per interaction. `map_view` is
 * the obvious one: it is the top of the funnel, and firing it on every pan
 * would inflate the denominator every other rate is measured against.
 */
const seen = new Set()
export function trackOnce(name, data = {}) {
  if (seen.has(name)) return
  seen.add(name)
  track(name, data)
}

// A tab being closed is the single most common way a batch is lost, and
// `visibilitychange → hidden` is the last event a browser reliably delivers —
// `beforeunload` is not fired at all on mobile Safari.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
