/**
 * GA4 mirroring of the mobile app's funnel — 2026-08-07.
 *
 * Every failure mode of this feature is SILENT. GA4 answers 2xx to a payload it
 * then discards, nothing here is awaited, and every error is swallowed by
 * design, so the only symptom of a break is a report that stays empty and gets
 * explained away as "nobody used the app that week". The properties below are
 * the ones that cannot be observed from the GA4 UI.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// tests/setup.js mocks config/env.js globally, so setting process.env here
// would never reach the module under test. Override that mock per case
// instead: `doMock` is not hoisted, so it applies to the dynamic import below.
async function loadGa4({ configured = true } = {}) {
  vi.resetModules()
  vi.doMock('../src/config/env.js', () => ({
    env: {
      ga4MeasurementId: configured ? 'G-TEST123' : null,
      ga4ApiSecret: configured ? 'secret123' : null,
    },
  }))
  return import('../src/features/analytics/ga4.js')
}

const req = ({ ua, platform } = {}) => ({
  body: platform ? { platform } : {},
  get: (h) => (h.toLowerCase() === 'user-agent' ? ua : undefined),
})

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.doUnmock('../src/config/env.js') })

describe('deciding what is app traffic', () => {
  it('believes an explicit platform over any User-Agent', async () => {
    const { isAppRequest } = await loadGa4()
    expect(isAppRequest(req({ platform: 'app', ua: 'Mozilla/5.0' }))).toBe(true)
    expect(isAppRequest(req({ platform: 'web', ua: 'okhttp/4.9.2' }))).toBe(false)
  })

  it('treats React Native networking stacks as the app', async () => {
    const { isAppRequest } = await loadGa4()
    expect(isAppRequest(req({ ua: 'okhttp/4.9.2' }))).toBe(true)      // Android
    expect(isAppRequest(req({ ua: 'CFNetwork/1494 Darwin/23.4.0' }))).toBe(true) // iOS
  })

  it('treats every browser as web, so gtag stays the only web reporter', async () => {
    const { isAppRequest } = await loadGa4()
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605',
      'Mozilla/5.0 (X11; Linux x86_64) Firefox/121',
    ]) expect(isAppRequest(req({ ua }))).toBe(false)
  })

  it('fails safe on an unknown caller: a missing UA is not an app user', async () => {
    // A phantom app user is worse than a missing row — it is a number someone
    // would act on. curl, a probe and a scanner all land here.
    const { isAppRequest } = await loadGa4()
    expect(isAppRequest(req({ ua: undefined }))).toBe(false)
    expect(isAppRequest(req({ ua: '' }))).toBe(false)
  })
})

describe('forwarding', () => {
  const events = [{ name: 'property_view', sessionId: 's_abc12345', propertyId: 'p1', city: 'Chennai' }]

  it('sends nothing at all when GA4 is not configured', async () => {
    const { forwardToGa4, ga4Configured } = await loadGa4({ configured: false })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    expect(ga4Configured()).toBe(false)
    forwardToGa4(events, 'u1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('carries the measurement id and secret as query params, never in the body', async () => {
    const { forwardToGa4 } = await loadGa4()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    forwardToGa4(events, 'u1')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('measurement_id=G-TEST123')
    expect(url).toContain('api_secret=secret123')
    expect(init.body).not.toContain('secret123')
  })

  it('keys the client on the session and the user on our own id', async () => {
    const { forwardToGa4 } = await loadGa4()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    forwardToGa4(events, 'u1')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.client_id).toBe('s_abc12345')
    expect(body.user_id).toBe('u1')
  })

  it('omits user_id entirely when signed out, rather than sending null', async () => {
    // GA4 rejects a null user_id; an anonymous funnel must still be recorded.
    const { forwardToGa4 } = await loadGa4()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    forwardToGa4(events, null)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    expect('user_id' in JSON.parse(fetchMock.mock.calls[0][1].body)).toBe(false)
  })

  it('stamps engagement_time_msec, without which GA4 shows nothing at all', async () => {
    const { forwardToGa4 } = await loadGa4()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    forwardToGa4(events, null)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [event] = JSON.parse(fetchMock.mock.calls[0][1].body).events
    expect(event.params.engagement_time_msec).toBe('1')
    expect(event.params.session_id).toBe('s_abc12345')
    expect(event.params.platform).toBe('app')
  })

  it('splits a batch at 25, the protocol cap, instead of truncating it', async () => {
    // The ingest schema allows 50. Sending them as one request would make GA4
    // drop the payload — and answer 2xx while doing it.
    const { forwardToGa4 } = await loadGa4()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

    const many = Array.from({ length: 50 }, () => ({ name: 'map_view', sessionId: 's_abc12345' }))
    forwardToGa4(many, null)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const counts = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).events.length)
    expect(counts).toEqual([25, 25])
  })

  it('never throws or rejects when GA is down', async () => {
    const { forwardToGa4 } = await loadGa4()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    expect(() => forwardToGa4(events, null)).not.toThrow()
    // An unhandled rejection here would take the process down on a public,
    // unauthenticated endpoint.
    await new Promise((r) => setTimeout(r, 10))
  })
})
