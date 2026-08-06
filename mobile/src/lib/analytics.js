// Product telemetry, mobile side. Mirror of frontend/src/lib/analytics.js —
// same event names, same batching, same silence on failure.
//
// Two deliberate differences from web, both because an app is not a tab:
//   - The session id lives in memory, not AsyncStorage. A "session" here is
//     one run of the app; persisting it across launches would stitch separate
//     visits into one and quietly turn an anonymous id into a device id.
//   - The flush trigger is AppState going to background, which is the mobile
//     equivalent of `visibilitychange` — a backgrounded app can be killed
//     without warning, so anything unsent at that moment is lost.
import { AppState } from 'react-native'
import { api } from '@lib/api'

const FLUSH_MS = 5000
const MAX_BATCH = 25

let queue = []
let timer = null

// Random per app run. No crypto.randomUUID on Hermes, and this needs to be
// unguessable-ish rather than cryptographic — it identifies a visit, not a
// person.
const SESSION_ID = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`

async function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length) return

  const events = queue.slice(0, MAX_BATCH)
  queue = queue.slice(MAX_BATCH)

  try {
    await api.post('/api/v1/analytics/events', { events })
  } catch {
    // Dropped on purpose — no retry queue. Telemetry that retries becomes a
    // second source of load exactly when the network is already failing.
  }
}

/**
 * Record one funnel step. Fire-and-forget — never await this.
 *
 * @param name  one of the five funnel steps (backend features/analytics/events.js)
 * @param data  { propertyId?, city?, props? } — no personal data, ever.
 */
export function track(name, data = {}) {
  try {
    queue.push({ name, sessionId: SESSION_ID, ...data })
    if (queue.length >= MAX_BATCH) { flush(); return }
    if (!timer) timer = setTimeout(flush, FLUSH_MS)
  } catch { /* telemetry must never break a tap */ }
}

/** Once per app run — for steps that are a visit, not an interaction. */
const seen = new Set()
export function trackOnce(name, data = {}) {
  if (seen.has(name)) return
  seen.add(name)
  track(name, data)
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flush()
})
