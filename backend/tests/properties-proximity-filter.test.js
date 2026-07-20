// "Within N metres of a metro" — the read half of the spatial proximity index.
//
// The defect this guards is not a wrong radius. It is that THREE outcomes look
// identical to someone reading a filtered list:
//
//   1. metro within the radius       → included, correct
//   2. metro genuinely further away  → excluded, correct
//   3. NO MAP DATA for that cell     → excluded, and nobody is told
//
// The third silently removes an owner's listing from results. It is the same
// absence-vs-ignorance confusion the spatial layer exists to prevent, in the one
// surface with nowhere to put a provenance chip.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  resolveProximityFilter, proximityCacheKey, proximitySchema, PROXIMITY_RADII,
} from '../src/features/properties/proximityFilter.js'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.cellPoiSummary = {
    findMany: vi.fn().mockResolvedValue([{ geohash: 'tdr1yf8' }, { geohash: 'tdr1yfa' }]),
  }
  prismaMock.property.count.mockResolvedValue(0)
})

describe('resolveProximityFilter', () => {
  it('costs nothing when no proximity filter is active', async () => {
    // The common case by far. It must not touch the database.
    expect(await resolveProximityFilter({ city: 'Chennai' })).toBeNull()
    expect(prismaMock.cellPoiSummary.findMany).not.toHaveBeenCalled()
  })

  it('constrains on geohash, the only link a listing has to a cell', async () => {
    const r = await resolveProximityFilter({ nearMetro: 800 })
    expect(r.where).toEqual({ geohash: { in: ['tdr1yf8', 'tdr1yfa'] } })
  })

  it('reports how many listings it could not judge', async () => {
    // 10 match the base filters, 6 sit in a cell measured for metro → 4 were set
    // aside for lack of data, NOT because we judged them too far. Without this
    // number the UI cannot tell the difference, and neither can the owner whose
    // listing vanished.
    prismaMock.property.count
      .mockResolvedValueOnce(10)  // all matching
      .mockResolvedValueOnce(6)   // matching AND in a measured cell

    const r = await resolveProximityFilter({ nearMetro: 800 }, { city: 'Chennai' })
    expect(r.unknown).toBe(4)
  })

  it('treats every listing as unjudged when nothing has been measured', async () => {
    // An unseeded city. The filter is about to return zero results, and saying
    // "we have no map data" is the entire difference between that and "there
    // are no homes near a metro here".
    prismaMock.cellPoiSummary.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(12)

    const r = await resolveProximityFilter({ nearMetro: 800 }, { city: 'Surat' })
    expect(r.unknown).toBe(12)
    expect(r.where).toEqual({ geohash: { in: [] } })
  })

  it('describes itself in distance, never in minutes', async () => {
    // A "15 minute walk" label would reintroduce the assumption deleted from
    // proximity.js: the number behind it is a STRAIGHT LINE, so a duration is a
    // guess wearing a measurement's voice.
    const near = await resolveProximityFilter({ nearMetro: 800 })
    const far = await resolveProximityFilter({ nearMetro: 3000 })

    expect(near.label).toBe('800 m of a metro station')
    expect(far.label).toBe('3.0 km of a metro station')
    expect(near.label).not.toMatch(/min|walk/)
  })

  it('drops the filter rather than silently returning everything on failure', async () => {
    // Returning null here makes the caller show an unfiltered list it can
    // explain. Returning "no constraint" would put listings nowhere near a
    // metro under a "near metro" heading, which is worse than an error.
    prismaMock.cellPoiSummary.findMany.mockRejectedValue(new Error('db down'))
    await expect(resolveProximityFilter({ nearMetro: 800 })).resolves.toBeNull()
  })
})

describe('proximityCacheKey', () => {
  it('varies by radius', async () => {
    // `filterCacheKey` walks the FILTERS registry and these are deliberately not
    // in it — so without this, nearMetro=800 and nearMetro=3000 would share a
    // cached pin set and serve each other's results.
    expect(proximityCacheKey({ nearMetro: 800 }))
      .not.toBe(proximityCacheKey({ nearMetro: 3000 }))
  })

  it('is stable when no proximity filter is active', () => {
    expect(proximityCacheKey({ city: 'Chennai' })).toBe(proximityCacheKey({}))
  })
})

describe('proximitySchema', () => {
  const parse = (v) => proximitySchema.nearMetro.safeParse(v)

  it('accepts only the radii the UI offers', () => {
    for (const r of PROXIMITY_RADII) expect(parse(String(r)).success).toBe(true)
  })

  it('rejects an arbitrary radius', () => {
    // A free-form metre value invites a precision the underlying distance does
    // not have — these are straight-line, not walking, distances.
    expect(parse('837').success).toBe(false)
    expect(parse('999999').success).toBe(false)
    expect(parse('-1').success).toBe(false)
  })
})
