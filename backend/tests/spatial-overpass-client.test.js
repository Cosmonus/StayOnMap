// Endpoint rotation and failure handling for the OSM seeders.
//
// This is the code the "keep using Overpass instead of building a Geofabrik
// pipeline" decision rests on (docs/spatial-intelligence.md §4.4), and until it
// was extracted it existed as two byte-identical copies with no tests on
// either. The failure it guards against is not theoretical: the primary
// endpoint 406'd for an entire work session (roadmap Addenda 10-11).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { overpassQuery, OVERPASS_ENDPOINTS, _resetPreferredEndpoint } from '../src/features/spatial/overpassClient.js'

const ENDPOINTS = ['https://a.test', 'https://b.test', 'https://c.test']

// The sticky mirror is process-lifetime state by design; between tests it is
// order-leak, so every case starts with it forgotten.
beforeEach(() => _resetPreferredEndpoint())

const ok = (body = { elements: [] }) => ({ ok: true, status: 200, json: async () => body })
const httpError = (status) => ({ ok: false, status, json: async () => ({}) })

describe('overpassQuery — rotation', () => {
  it('uses the first endpoint that works and stops there', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ elements: [1] }))
    const body = await overpassQuery('[out:json];', { endpoints: ENDPOINTS, fetchImpl })

    expect(body).toEqual({ elements: [1] })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toBe('https://a.test')
  })

  it('falls through an HTTP error to the next mirror', async () => {
    // 406 is literally what the primary returned for a whole session; 429 and
    // 504 are Overpass's normal way of saying "busy". None of them mean the
    // query is bad, so none of them should end the attempt.
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(httpError(406))
      .mockResolvedValueOnce(ok({ elements: ['from-b'] }))

    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    expect(body.elements).toEqual(['from-b'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falls through a thrown network error too', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok({ elements: ['from-b'] }))

    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    expect(body.elements).toEqual(['from-b'])
  })

  it('tries every mirror before giving up', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpError(504))
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(ENDPOINTS.length)
  })

  it('does NOT retry the same endpoint', async () => {
    // Callers already retry failed tiles once, where the failure is recorded as
    // a coverage gap. Retrying here too would multiply into a burst of load on
    // a free service that was, by hypothesis, already struggling.
    const fetchImpl = vi.fn().mockResolvedValue(httpError(429))
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })).rejects.toThrow()

    const called = fetchImpl.mock.calls.map((c) => c[0])
    expect(new Set(called).size).toBe(called.length)
  })
})

describe('overpassQuery — sticky mirror', () => {
  it('tries the mirror that answered last FIRST on the next call', async () => {
    // The 2026-08-20 prod POI seed: overpass-api.de ETIMEDOUT on every one of
    // Delhi's 16 tiles before the same mirror answered each time. One dead
    // primary must cost its timeout once per process, not once per tile.
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { code: 'ETIMEDOUT' }))
      .mockResolvedValue(ok({ elements: [] }))

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl }) // a fails → b answers
    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl }) // must start at b

    const called = fetchImpl.mock.calls.map((c) => c[0])
    expect(called).toEqual(['https://a.test', 'https://b.test', 'https://b.test'])
  })

  it('falls through normally when the preferred mirror dies too', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('a down'))
      .mockResolvedValueOnce(ok())          // b answers → preferred
      .mockResolvedValueOnce(httpError(504)) // b busy next call
      .mockResolvedValueOnce(ok({ elements: ['from-a'] }))

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })

    expect(body.elements).toEqual(['from-a'])
    // Second call: b (preferred, 504) then a (the rest in declared order).
    expect(fetchImpl.mock.calls.map((c) => c[0]).slice(2)).toEqual(['https://b.test', 'https://a.test'])
  })

  it('ignores a preference that is not in the caller-supplied list', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('a down'))
      .mockResolvedValue(ok())

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl }) // preferred = b.test
    await overpassQuery('q', { endpoints: ['https://x.test', 'https://y.test'], fetchImpl })

    // The second call's list has no b.test — declared order must hold.
    expect(fetchImpl.mock.calls[2][0]).toBe('https://x.test')
  })
})

describe('overpassQuery — failure is loud', () => {
  it('throws rather than returning an empty result set', async () => {
    // The single most important behaviour here. An empty `elements` array from
    // a total failure would be written to PoiIndex as "this city has nothing",
    // which is the exact confusion between absence and ignorance that the whole
    // provenance layer exists to prevent.
    const fetchImpl = vi.fn().mockResolvedValue(httpError(503))
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl }))
      .rejects.toThrow(/503/)
  })

  it('surfaces the last error, not a generic one', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(httpError(406))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('timeout of 180000ms exceeded'))

    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl }))
      .rejects.toThrow(/timeout/)
  })

  it('reports a clear error when given no endpoints at all', async () => {
    await expect(overpassQuery('q', { endpoints: [], fetchImpl: vi.fn() }))
      .rejects.toThrow(/all Overpass endpoints failed/)
  })
})

describe('overpassQuery — request shape', () => {
  it('POSTs the query as form-encoded data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok())
    await overpassQuery('[out:json];node(1);out;', { endpoints: ENDPOINTS, fetchImpl })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body.get('data')).toBe('[out:json];node(1);out;')
  })

  it('identifies itself, because Overpass asks callers to', async () => {
    // An anonymous bulk caller gets blocked rather than contacted.
    const fetchImpl = vi.fn().mockResolvedValue(ok())
    await overpassQuery('q', {
      endpoints: ENDPOINTS, fetchImpl, userAgent: 'StayOnMap/1.0 (test seed; https://x)',
    })
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toMatch(/StayOnMap/)
  })

  it('always carries an abort signal, so a hung mirror cannot stall a seed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok())
    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, timeoutMs: 1000 })
    expect(fetchImpl.mock.calls[0][1].signal).toBeDefined()
  })
})

describe('the shipped endpoint list', () => {
  it('keeps more than one mirror', () => {
    // Rotation with a single endpoint is not rotation. If this list is ever
    // trimmed to one, the seeders lose their only defence against the outage
    // that has already happened once.
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(1)
    expect(new Set(OVERPASS_ENDPOINTS).size).toBe(OVERPASS_ENDPOINTS.length)
    for (const e of OVERPASS_ENDPOINTS) expect(e).toMatch(/^https:\/\//)
  })
})
