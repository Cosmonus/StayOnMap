// Walk-time on cards: MEASURED when the router answers, ABSENT otherwise.
// The rule under test: no router → the payload passes through IDENTICAL
// (same object references — the cached envelopes must never be mutated), and
// no fact ever carries an assumed walk time.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichWithWalkTimes } from '../src/features/spatial/walkEnrich.js'
import { resetRoutingHealth } from '../src/features/spatial/routingProvider.js'
import { env } from '../src/config/env.js'

const MODULES = () => ({
  lifestyle: {
    confidence: 0.7,
    facts: [
      { key: 'nearest_supermarket', unit: 'm', value: 420, display: 'Avadi Supermarket — 420 m away', at: { lat: 12.98, lng: 77.6 }, provenance: 'DERIVED' },
      { key: 'supermarket_count', unit: 'count', value: 4, display: '4 within 1.6 km' }, // no `at` — not enrichable
    ],
  },
  mobility: {
    facts: [{ key: 'nearest_metro', unit: 'm', value: 900, display: 'Indiranagar — 900 m away', at: { lat: 12.97, lng: 77.64 } }],
  },
})

const okProbe = { ok: true, json: async () => ({ code: 'Ok' }) }

beforeEach(() => {
  resetRoutingHealth()
  env.routingUrl = 'http://router.test:5000'
})

it('router unconfigured → the exact same object back, untouched', async () => {
  env.routingUrl = null
  const input = MODULES()
  const out = await enrichWithWalkTimes(input, 12.9716, 77.5946, vi.fn())
  expect(out).toBe(input)
})

it('router down → same object back, one probe, no table call', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
  const input = MODULES()
  expect(await enrichWithWalkTimes(input, 12.9716, 77.5946, fetchMock)).toBe(input)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('router up → distance facts gain a MEASURED walk, counts stay untouched, cache never mutated', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okProbe)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [[0, 610, 1310]],
        durations: [[0, 480, 1020]],
      }),
    })
  const input = MODULES()
  const out = await enrichWithWalkTimes(input, 12.9716, 77.5946, fetchMock)

  const market = out.lifestyle.facts[0]
  expect(market.walk).toEqual({
    meters: 610,
    minutes: 8,
    provenance: 'MEASURED',
    method: expect.stringContaining('OSRM'),
  })
  expect(market.display).toBe('Avadi Supermarket — 420 m away · about 8 min walk')
  // The original DERIVED haversine claim is untouched — two claims, two labels.
  expect(market.value).toBe(420)
  expect(market.provenance).toBe('DERIVED')

  expect(out.mobility.facts[0].walk.minutes).toBe(17)
  // Non-distance facts pass through by reference; input objects not mutated.
  expect(out.lifestyle.facts[1]).toBe(input.lifestyle.facts[1])
  expect(input.lifestyle.facts[0].walk).toBeUndefined()
})

it('an unsnappable POI keeps its fact exactly as it was', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okProbe)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'Ok', distances: [[0, null, 1310]], durations: [[0, null, 1020]] }),
    })
  const input = MODULES()
  const out = await enrichWithWalkTimes(input, 12.9716, 77.5946, fetchMock)
  expect(out.lifestyle.facts[0]).toBe(input.lifestyle.facts[0]) // no walk invented
  expect(out.mobility.facts[0].walk.meters).toBe(1310)
})
