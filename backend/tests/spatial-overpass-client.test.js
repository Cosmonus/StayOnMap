// Endpoint rotation and failure handling for the OSM seeders.
//
// This is the code the "keep using Overpass instead of building a Geofabrik
// pipeline" decision rests on (docs/spatial-intelligence.md §4.4), and until it
// was extracted it existed as two byte-identical copies with no tests on
// either. The failure it guards against is not theoretical: the primary
// endpoint 406'd for an entire work session (roadmap Addenda 10-11).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { overpassQuery, OVERPASS_ENDPOINTS, _resetOverpassState } from '../src/features/spatial/overpassClient.js'

const ENDPOINTS = ['https://a.test', 'https://b.test', 'https://c.test']

// Sticky mirror, network cooldowns and the polite pause are all
// process-lifetime state by design; between tests that is order-leak, so
// every case starts with all of it forgotten.
beforeEach(() => _resetOverpassState())

const ok = (body = { elements: [] }) => ({ ok: true, status: 200, json: async () => body })
const httpError = (status) => ({ ok: false, status, json: async () => ({}) })
const busy = (status) => httpError(status)
const dead = () => Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ETIMEDOUT' } }))

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
    // busyBackoffMs: [] — this asserts ROTATION; the busy sit-out has its own
    // describe below and would otherwise turn 504 into three timed rounds.
    const fetchImpl = vi.fn().mockResolvedValue(httpError(504))
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [] })).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(ENDPOINTS.length)
  })

  it('does NOT retry the same endpoint', async () => {
    // Callers already retry failed tiles once, where the failure is recorded as
    // a coverage gap. Retrying here too would multiply into a burst of load on
    // a free service that was, by hypothesis, already struggling.
    const fetchImpl = vi.fn().mockResolvedValue(httpError(429))
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [] })).rejects.toThrow()

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
      .mockResolvedValueOnce(ok({ elements: ['from-c'] }))

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [] })

    expect(body.elements).toEqual(['from-c'])
    // Second call: b (preferred, 504) then c — NOT a, whose network failure on
    // the first call put it on cooldown (see the cooldown describe below).
    expect(fetchImpl.mock.calls.map((c) => c[0]).slice(2)).toEqual(['https://b.test', 'https://c.test'])
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

// ── Busy backoff (2026-08-24) ────────────────────────────────────────────────
// From a real run: maps.mail.ru was the only reachable mirror from the VM, it
// 504'd after one oversized central-Delhi tile, and every remaining tile of a
// 47-city seed failed instantly. "Busy" is a request to wait, not an outage.
describe('busy backoff', () => {
  it('sits out, then retries ONLY the mirror that said busy — not the dead ones', async () => {
    // Same run, later the same day: the sit-out worked, but every retry round
    // re-paid the two unreachable mirrors' connection timeouts before reaching
    // the one that had actually answered. The retry exists for the mirror that
    // said "busy"; the ones that never answered are cooling down.
    const sleeps = []
    const fetchImpl = vi.fn()
      // round 1: all three fail — a and c never answer, b says busy
      .mockImplementationOnce(dead)
      .mockResolvedValueOnce(busy(504))
      .mockImplementationOnce(dead)
      // round 2: b alone, recovered
      .mockResolvedValueOnce(ok({ elements: [1] }))

    const out = await overpassQuery('q', {
      endpoints: ENDPOINTS, fetchImpl,
      busyBackoffMs: [10, 20], sleepImpl: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })

    expect(out).toEqual({ elements: [1] })
    expect(sleeps).toEqual([10])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fetchImpl.mock.calls[3][0]).toBe('https://b.test')
  })

  it('waits at most busyBackoffMs.length times, then throws', async () => {
    const sleeps = []
    const fetchImpl = vi.fn().mockResolvedValue(busy(429))

    await expect(overpassQuery('q', {
      endpoints: ENDPOINTS, fetchImpl,
      busyBackoffMs: [10, 20], sleepImpl: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })).rejects.toThrow(/HTTP 429/)

    expect(sleeps).toEqual([10, 20])          // 3 rotations total
    expect(fetchImpl).toHaveBeenCalledTimes(9) // 3 endpoints × 3 rounds — HTTP errors never cool a mirror
  })

  it('does NOT wait when every failure is a network error — nothing to wait for', async () => {
    const sleeps = []
    const fetchImpl = vi.fn().mockImplementation(dead)

    await expect(overpassQuery('q', {
      endpoints: ENDPOINTS, fetchImpl,
      busyBackoffMs: [10], sleepImpl: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })).rejects.toThrow()

    expect(sleeps).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

// ── Network cooldown (2026-08-24) ────────────────────────────────────────────
// A mirror that THREW (never answered) is skipped for a while, so a run where
// only one mirror is reachable stops re-paying the dead ones' timeouts on
// every busy round and every subsequent call. An HTTP error of any status is
// an ANSWER — it never cools a mirror down.
describe('network cooldown', () => {
  it('skips a mirror that network-failed on an earlier call', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(dead)     // call 1: a dead → cooldown
      .mockImplementationOnce(dead)     // call 1: b dead → cooldown
      .mockResolvedValueOnce(ok())      // call 1: c answers → preferred
      .mockResolvedValueOnce(busy(504)) // call 2: c busy

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [] }))
      .rejects.toThrow(/504/)

    // The second call tried ONLY c — a and b were cooling down.
    expect(fetchImpl.mock.calls.map((c) => c[0]).slice(3)).toEqual(['https://c.test'])
  })

  it('still tries everything when every mirror is cooling down', async () => {
    // The cooldown is a memory, and memory alone must never fail a call: a
    // guess that every mirror is dead is still tested against reality.
    const fetchImpl = vi.fn().mockImplementation(dead)

    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })).rejects.toThrow()
    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })).rejects.toThrow()

    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('an HTTP error never cools a mirror down — the host answered', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(httpError(500)) // call 1: a → 500 (alive, just unhappy)
      .mockResolvedValueOnce(ok())           // call 1: b answers → preferred
      .mockImplementationOnce(dead)          // call 2: b dead
      .mockResolvedValueOnce(ok({ elements: ['from-a'] })) // call 2: a must still be tried

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })
    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl })

    expect(body.elements).toEqual(['from-a'])
    expect(fetchImpl.mock.calls.map((c) => c[0]).slice(2)).toEqual(['https://b.test', 'https://a.test'])
  })

  it('expires, so a recovered mirror is rediscovered mid-run', async () => {
    // networkCooldownMs: 0 = already expired — the mirror is tried again at once.
    const fetchImpl = vi.fn()
      .mockImplementationOnce(dead)  // call 1: a dead
      .mockResolvedValueOnce(ok())   // call 1: b → preferred
      .mockImplementationOnce(dead)  // call 2: b dead
      .mockResolvedValueOnce(ok({ elements: ['from-a'] })) // call 2: a, back in rotation

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, networkCooldownMs: 0 })
    const body = await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, networkCooldownMs: 0 })

    expect(body.elements).toEqual(['from-a'])
  })
})

// ── Adaptive pacing (2026-08-24) ─────────────────────────────────────────────
// The seeders pause a fixed 2 s between tiles — exactly the rate that made the
// one live mirror 504 city after city on the 2026-08-24 run. Once a call hits
// the busy sit-out, the next calls open with a pause that doubles per episode
// and decays on clean successes: the client-side half of "busy is a request to
// wait".
describe('adaptive pacing', () => {
  it('opens the next call with a pause after a busy sit-out', async () => {
    const sleeps = []
    const sleepImpl = (ms) => { sleeps.push(ms); return Promise.resolve() }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(busy(504)) // call 1 round 1: a busy
      .mockImplementationOnce(dead)     //                b dead
      .mockImplementationOnce(dead)     //                c dead
      .mockResolvedValueOnce(ok())      // call 1 round 2: a alone, recovered
      .mockResolvedValue(ok())          // call 2

    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [5], sleepImpl })
    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, sleepImpl })

    // Call 1 slept its sit-out; call 2 opened with the 10 s polite pause.
    expect(sleeps).toEqual([5, 10_000])
  })

  it('grows the pause even when the busy call ultimately fails', async () => {
    // The caller's tile-level retry is about to repeat the question; asking it
    // at full speed is how this failure was earned.
    const sleeps = []
    const sleepImpl = (ms) => { sleeps.push(ms); return Promise.resolve() }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValue(ok())

    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [], sleepImpl }))
      .rejects.toThrow()
    await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, sleepImpl })

    expect(sleeps).toEqual([10_000])
  })

  it('decays on clean successes and reaches zero', async () => {
    const sleeps = []
    const sleepImpl = (ms) => { sleeps.push(ms); return Promise.resolve() }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValueOnce(busy(429))
      .mockResolvedValue(ok())

    await expect(overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, busyBackoffMs: [], sleepImpl }))
      .rejects.toThrow()
    // Each clean call halves the pause: 10 s → 5 s → 2.5 s → 1.25 s → 0.
    for (let i = 0; i < 5; i++) {
      await overpassQuery('q', { endpoints: ENDPOINTS, fetchImpl, sleepImpl })
    }

    expect(sleeps).toEqual([10_000, 5_000, 2_500, 1_250])
  })
})
