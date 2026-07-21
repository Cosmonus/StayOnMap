// The routing provider's one non-negotiable: ABSENT IS A SUPPORTED STATE.
// Down, unconfigured, erroring, or half-loaded, the answer is null and the
// caller keeps today's haversine behaviour — a router can never break a page.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { walkTable, routingAvailable, routingConfigured, resetRoutingHealth } from '../src/features/spatial/routingProvider.js'
import { env } from '../src/config/env.js'

const FROM = { lat: 12.9716, lng: 77.5946 }
const TOS = [{ lat: 12.98, lng: 77.6 }, { lat: 12.99, lng: 77.61 }]

const okProbe = { ok: true, json: async () => ({ code: 'Ok' }) }

beforeEach(() => {
  resetRoutingHealth()
  env.routingUrl = 'http://router.test:5000'
})

describe('unconfigured / down', () => {
  it('no ROUTING_URL → not configured, walkTable null, zero network calls', async () => {
    env.routingUrl = null
    const fetchMock = vi.fn()
    expect(routingConfigured()).toBe(false)
    expect(await walkTable(FROM, TOS, fetchMock)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a router that answers the port but fails routes (graph still loading) is DOWN', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'NoSegment' }) })
    expect(await routingAvailable(fetchMock)).toBe(false)
  })

  it('health is cached — a dead router costs one probe per window, not one per cell', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await routingAvailable(fetchMock)).toBe(false)
    expect(await routingAvailable(fetchMock)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('walkTable', () => {
  it('one origin, many destinations, one /table call — distances in metres and seconds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okProbe) // health probe
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          // row 0 = our source; column 0 = origin-to-itself
          distances: [[0, 1234.6, 2200.2]],
          durations: [[0, 900.4, 1600.9]],
        }),
      })
    const result = await walkTable(FROM, TOS, fetchMock)
    expect(result).toEqual([
      { walkM: 1235, walkSeconds: 900 },
      { walkM: 2200, walkSeconds: 1601 },
    ])
    const tableUrl = fetchMock.mock.calls[1][0]
    expect(tableUrl).toContain('/table/v1/foot/')
    expect(tableUrl).toContain('sources=0')
  })

  it('an unsnappable destination is per-item null, not a poisoned batch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okProbe)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 'Ok', distances: [[0, null, 500]], durations: [[0, null, 400]] }),
      })
    const result = await walkTable(FROM, TOS, fetchMock)
    expect(result).toEqual([null, { walkM: 500, walkSeconds: 400 }])
  })

  it('a mid-flight failure returns null AND flips the health cache', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okProbe)
      .mockRejectedValueOnce(new Error('socket hang up'))
    expect(await walkTable(FROM, TOS, fetchMock)).toBeNull()
    // Next call skips straight to unavailable without another probe.
    const after = vi.fn()
    expect(await walkTable(FROM, TOS, after)).toBeNull()
    expect(after).not.toHaveBeenCalled()
  })

  it('empty destination list is an empty answer, not a router call', async () => {
    const fetchMock = vi.fn()
    expect(await walkTable(FROM, [], fetchMock)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
