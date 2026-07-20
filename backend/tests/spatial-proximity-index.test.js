// Proximity promoted from JSON into columns, so it can be FILTERED on.
//
// The spatial layer already knew what was near a cell — as JSON inside a module
// envelope, which reads whole and filters not at all. "Flats within 800 m of a
// metro" was impossible while the data to answer it sat in the database.
//
// The failure mode worth guarding here is not a wrong distance. It is writing a
// row at all when the city was never seeded: an unseeded city and a genuinely
// empty one produce the same shape, and a zero baked into a filter index is a
// caveat nobody will ever see.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  refreshCellProximity, cellsNear, FILTERABLE_POI_CATEGORIES,
} from '../src/features/spatial/proximityIndex.js'
import * as poiProvider from '../src/features/spatial/poiProvider.js'

const CELL = { lat: 12.9784, lng: 77.6408, city: 'Bengaluru' }
const GEOHASH = 'tdr1yf8'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.cellPoiSummary = {
    upsert: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  }
})

const seeded = (byCategory) => ({ available: true, byCategory, sparselyMapped: false })

describe('refreshCellProximity', () => {
  it('summarises each category into nearest plus two counts', async () => {
    vi.spyOn(poiProvider, 'poisNear').mockResolvedValue(seeded({
      railway_station: [{ distanceM: 240 }, { distanceM: 910 }, { distanceM: 1500 }],
    }))

    await refreshCellProximity(GEOHASH, CELL, ['railway_station'])

    const { create } = prismaMock.cellPoiSummary.upsert.mock.calls[0][0]
    expect(create.nearestM).toBe(240)
    expect(create.count800M).toBe(1)    // only the 240m one
    expect(create.count1600M).toBe(3)
  })

  it('records null — not zero — when a category has nothing in range', async () => {
    // Zero would be a claim ("there are no schools here"); null is the absence
    // of one. A filter reading zero as a distance would match every property.
    vi.spyOn(poiProvider, 'poisNear').mockResolvedValue(seeded({ school: [] }))

    await refreshCellProximity(GEOHASH, CELL, ['school'])

    const { create } = prismaMock.cellPoiSummary.upsert.mock.calls[0][0]
    expect(create.nearestM).toBeNull()
    expect(create.count800M).toBe(0)
  })

  it('writes NOTHING when the city was never seeded', async () => {
    // The one that matters. An unseeded city and an empty one look identical
    // here, and a zero baked into a filter index carries no caveat with it —
    // it would silently assert "no metro near this listing" about a city whose
    // POIs simply have not been downloaded.
    vi.spyOn(poiProvider, 'poisNear').mockResolvedValue({ available: false })

    const written = await refreshCellProximity(GEOHASH, CELL, ['railway_station'])
    expect(written).toBe(0)
    expect(prismaMock.cellPoiSummary.upsert).not.toHaveBeenCalled()
  })

  it('upserts, so a recompute replaces rather than accumulates', async () => {
    vi.spyOn(poiProvider, 'poisNear').mockResolvedValue(seeded({ park: [{ distanceM: 100 }] }))
    await refreshCellProximity(GEOHASH, CELL, ['park'])

    const call = prismaMock.cellPoiSummary.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ geohash_category: { geohash: GEOHASH, category: 'park' } })
    expect(call.update).toBeDefined()
  })

  it('never lets an index failure break the cell it belongs to', async () => {
    // This runs inside materialize(). Proximity is an optimisation over data
    // that already exists; failing to write it must not cost the envelopes.
    vi.spyOn(poiProvider, 'poisNear').mockRejectedValue(new Error('db gone'))
    await expect(refreshCellProximity(GEOHASH, CELL, ['park'])).resolves.toBe(0)
  })

  it('does nothing without a geohash, cell or categories', async () => {
    expect(await refreshCellProximity(null, CELL, ['park'])).toBe(0)
    expect(await refreshCellProximity(GEOHASH, null, ['park'])).toBe(0)
    expect(await refreshCellProximity(GEOHASH, CELL, [])).toBe(0)
  })
})

describe('cellsNear', () => {
  it('asks only for cells with a real distance inside the radius', async () => {
    await cellsNear('railway_station', 800)

    const { where } = prismaMock.cellPoiSummary.findMany.mock.calls[0][0]
    expect(where.category).toBe('railway_station')
    // `not: null` is load-bearing: without it, "nothing within range" rows
    // would satisfy `lte` in some drivers and match everything.
    expect(where.nearestM).toEqual({ not: null, lte: 800 })
  })

  it('caps the result set', async () => {
    // A predicate matching most of a city is not a filter anyone meant to
    // apply, and an unbounded IN list is a slow query pretending to be one.
    await cellsNear('park', 1600)
    expect(prismaMock.cellPoiSummary.findMany.mock.calls[0][0].take).toBeGreaterThan(0)
  })

  it('returns plain geohashes, not rows', async () => {
    prismaMock.cellPoiSummary.findMany.mockResolvedValue([{ geohash: 'a' }, { geohash: 'b' }])
    expect(await cellsNear('park', 800)).toEqual(['a', 'b'])
  })
})

describe('FILTERABLE_POI_CATEGORIES', () => {
  it('is a deliberate subset, not the whole vocabulary', async () => {
    // Every category costs a row per cell and a line of UI. Twenty-six filters
    // is not a feature, and most of the vocabulary answers a question nobody
    // filters by — people pick a home near a station, not near a laundry.
    const { CATEGORY_KEYS } = await import('../src/features/spatial/poiCategories.js')
    expect(FILTERABLE_POI_CATEGORIES.length).toBeLessThan(CATEGORY_KEYS.length)
    for (const c of FILTERABLE_POI_CATEGORIES) expect(CATEGORY_KEYS).toContain(c)
  })
})
