// Forwards the mobile app's funnel events to GA4, over the Measurement
// Protocol.
//
// WHY THE SERVER AND NOT AN SDK IN THE APP. Google Analytics on React Native
// means @react-native-firebase/analytics: two native dependencies, a Firebase
// project with Analytics enabled, a re-downloaded google-services.json, an EAS
// build, and a new SDK to declare in Play Data Safety — and none of it reaches
// a phone until someone installs the next release. The app ALREADY posts its
// funnel to us (mobile/src/lib/analytics.js). Forwarding what we are given
// costs no dependency, no build, and works on builds already installed today.
//
// APP ONLY, AND THAT IS NOT AN OVERSIGHT. The website carried a gtag for part
// of 2026-08-07 and it was removed the same day: it set `_ga` cookies, which
// was the only reason this product needed a cookie policy or a consent banner
// at all. /privacy now tells web visitors the website sends Google nothing, so
// mirroring web events from the server would be the same data sharing wearing
// a different transport. `isAppRequest` is therefore a privacy gate, not a
// de-duplication trick — see analytics.controller.js.
//
// What it does not buy, stated plainly because the gap is invisible in the GA4
// UI: no automatic `first_open`, `session_start`, `screen_view`, no device or
// demographic dimensions, no retention cohorts. GA4 will show the five funnel
// steps for app traffic and nothing else. Choosing the SDK later replaces this
// file; the events keep their names, so history stays comparable.
//
// OUR POSTGRES REMAINS THE SOURCE OF TRUTH. This is a mirror for whoever is
// already looking at GA4. Every failure here is swallowed — GA being down, slow
// or misconfigured must never cost us a row in our own table.
import { env } from '../../config/env.js'

const ENDPOINT = 'https://www.google-analytics.com/mp/collect'

// Own log channel, same single-line JSON shape the rest of the app uses.
// Deliberately NOT intelLog's `src:"intel"` — that channel is the fraud and
// scoring decisions, and burying an analytics transport failure in it makes
// both harder to grep for.
const logFailure = (event, data) => {
  if (process.env.NODE_ENV === 'test') return
  console.error(JSON.stringify({ ts: new Date().toISOString(), src: 'ga4', event, ...data }))
}

// The Measurement Protocol caps a request at 25 events. Our ingest schema
// allows a batch of 50, so a full batch must be split rather than truncated.
const MAX_EVENTS_PER_REQUEST = 25

// A hung request must not accumulate sockets on a public endpoint. Nothing
// waits on the result, so the only cost of giving up is one lost mirror row.
const TIMEOUT_MS = 3000

/**
 * Configured or not, in one place — the same shape as `smsConfigured()`. Both
 * values are required: the measurement id alone identifies the property, the
 * API secret is what authorises writing to it.
 */
export function ga4Configured() {
  return Boolean(env.ga4MeasurementId && env.ga4ApiSecret)
}

/**
 * Is this request from the app rather than a browser?
 *
 * Released builds send no platform marker — that is the entire constraint this
 * feature is designed around — so for them we read the User-Agent. Every
 * browser on earth sends one starting `Mozilla/`; React Native's networking
 * stack sends `okhttp/…` on Android and `CFNetwork/…` on iOS. The test is
 * therefore "not a browser", which fails SAFE: an unrecognised caller is
 * treated as web and simply is not mirrored, so the worst case is a missing
 * row in GA4 rather than a phantom app user.
 *
 * `platform` in the body wins when present. It is optional precisely so that
 * released builds keep working unchanged while new ones are exact, and once
 * every build in the wild sends it the sniffing below can be deleted.
 */
export function isAppRequest(req) {
  if (req.body?.platform) return req.body.platform === 'app'

  const ua = req.get('user-agent') || ''
  // No User-Agent at all is NOT the app — it is curl, a probe or a scanner.
  // Without this line "not a browser" quietly includes "not anything", and the
  // endpoint is public, so anything on the internet could mint app users.
  if (!ua) return false
  return !/^Mozilla\//i.test(ua)
}

/**
 * GA4 rejects a param bag with unexpected shapes, and we must never hand it
 * anything personal. Only the closed set the ingest schema already validated
 * gets through, and `props` values are primitives by that schema.
 */
function paramsFor(event) {
  return {
    ...(event.props ?? {}),
    ...(event.propertyId ? { property_id: event.propertyId } : {}),
    ...(event.city ? { city: event.city } : {}),
    // GA4 groups events into a session by this pair, and events without
    // `engagement_time_msec` are missing from the engagement reports and from
    // Realtime entirely — the symptom being "I sent events and GA shows
    // nothing". 1ms is the documented minimum placeholder: we cannot measure
    // real engagement time from a server, and inventing a duration would be a
    // number someone would later trust.
    session_id: event.sessionId,
    engagement_time_msec: '1',
    // Every event in this property is app traffic — the website's tag was
    // removed on 2026-08-07 — but the dimension stays, because a report that
    // silently assumes its only source is the one that breaks quietly if a web
    // source is ever added back.
    platform: 'app',
  }
}

/**
 * Mirror a validated batch to GA4. Fire-and-forget: never awaited, never
 * throws, returns nothing.
 *
 * `client_id` is the app's session id, which makes one app RUN look like one
 * GA4 user — app "users" will track sessions, and that number is not
 * comparable to the website's. The honest alternative needs a stable install
 * id, which means a client change, which means a new build; the whole point of
 * this route is working without one. `user_id` is sent when we know it, so
 * GA4 can still collapse a signed-in person across sessions if User-ID
 * reporting is switched on for the property.
 */
export function forwardToGa4(events, userId = null) {
  if (!ga4Configured() || !events?.length) return

  for (let i = 0; i < events.length; i += MAX_EVENTS_PER_REQUEST) {
    const chunk = events.slice(i, i + MAX_EVENTS_PER_REQUEST)
    send(chunk, userId).catch(() => {})
  }
}

async function send(chunk, userId) {
  const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(env.ga4MeasurementId)}`
    + `&api_secret=${encodeURIComponent(env.ga4ApiSecret)}`

  const body = {
    // One request carries one client, so a batch spanning two sessions has to
    // be keyed by the first one. In practice a flush is always one session:
    // the client holds one id for its whole run.
    client_id: chunk[0].sessionId,
    ...(userId ? { user_id: userId } : {}),
    events: chunk.map((e) => ({ name: e.name, params: paramsFor(e) })),
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // GA4 answers 204 on success and, notoriously, 2xx for a payload it then
    // silently discards — a bad measurement id included. Only transport-level
    // failure is visible here, so a non-2xx is worth a log line: the usual
    // cause is a wrong or revoked API secret, which is otherwise invisible
    // until someone notices GA4 has been empty for a week.
    if (!res.ok) {
      logFailure('forward_rejected', { status: res.status, events: chunk.length })
    }
  } catch (err) {
    logFailure('forward_failed', { error: err.message, events: chunk.length })
  }
}
