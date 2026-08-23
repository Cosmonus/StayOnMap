/**
 * Search demand — 2026-08-07
 *
 * The table answers "what did people ask for that we could not show them", and
 * it has three properties that are the whole design:
 *
 *   1. It is AGGREGATE. One row per (day, query shape), counters on top. There
 *      is no sessionId or userId in it and nowhere to put one.
 *   2. It is COARSE. Area is a ~4.9km cell, budget is a band. Panning a street
 *      or dragging a slider one tick must not fork a row.
 *   3. A search is counted whether or not Redis had the answer — otherwise
 *      demand is undercounted by exactly the amount that popular areas are
 *      popular.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  demandShape, signatureOf, rentBand, recordSearchDemand, getUnmetDemand,
} from '../src/features/analytics/demand.service.js'

const BENGALURU_VIEWPORT = { swLat: 12.90, swLng: 77.58, neLat: 12.97, neLng: 77.67 }

beforeEach(() => { vi.clearAllMocks() })

describe('rentBand', () => {
  it('bands the budget rather than carrying the raw number', () => {
    expect(rentBand(null, 8000)).toBe('0-10k')
    expect(rentBand(null, 25000)).toBe('20k-35k')
    expect(rentBand(null, 250000)).toBe('1L+')
  })

  it('treats no budget filter as distinct from a zero budget', () => {
    expect(rentBand(null, null)).toBeNull()
    expect(rentBand(null, 0)).toBeNull()
  })

  it('puts a one-rupee difference in the same band — the point of banding', () => {
    expect(rentBand(null, 19999)).toBe(rentBand(null, 20000))
  })
})

describe('demandShape', () => {
  it('records the area at ~5km, not at the viewport', () => {
    const shape = demandShape(BENGALURU_VIEWPORT, {})
    // Geohash-5. Precise enough to distinguish parts of a city, far too blunt
    // to locate a person.
    expect(shape.cellGeohash).toHaveLength(5)
  })

  it('collapses a small pan into the same cell', () => {
    const nudged = { swLat: 12.901, swLng: 77.581, neLat: 12.971, neLng: 77.671 }
    expect(demandShape(nudged, {}).cellGeohash)
      .toBe(demandShape(BENGALURU_VIEWPORT, {}).cellGeohash)
  })

  it('separates genuinely different parts of a city', () => {
    const whitefield = { swLat: 12.95, swLng: 77.72, neLat: 13.00, neLng: 77.78 }
    expect(demandShape(whitefield, {}).cellGeohash)
      .not.toBe(demandShape(BENGALURU_VIEWPORT, {}).cellGeohash)
  })

  it('keeps a single-choice filter and drops a multi-choice one', () => {
    // "APARTMENT" is an instruction about what to go and list. "APARTMENT,
    // HOUSE,LAND" is not a thing anyone is short of.
    expect(demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT' }).type).toBe('APARTMENT')
    expect(demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT,HOUSE' }).type).toBeNull()
  })

  it('returns null for incomplete bounds rather than inventing a centre', () => {
    expect(demandShape({ swLat: 12.9, swLng: 77.5 }, {})).toBeNull()
    expect(demandShape(null, {})).toBeNull()
  })

  it('carries no session, user or IP — there is nowhere to put one', () => {
    const shape = demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT' })
    expect(Object.keys(shape).sort()).toEqual(
      ['bhk', 'cellGeohash', 'city', 'pricingModel', 'rentBand', 'type']
    )
  })
})

describe('signatureOf', () => {
  it('is stable for the same query shape', () => {
    const a = demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT', rentMax: 20000 })
    const b = demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT', rentMax: 19500 })
    // Same band, same cell — one row, not two.
    expect(signatureOf(a)).toBe(signatureOf(b))
  })

  it('differs when the ask differs', () => {
    const flats = demandShape(BENGALURU_VIEWPORT, { type: 'APARTMENT' })
    const plots = demandShape(BENGALURU_VIEWPORT, { type: 'LAND' })
    expect(signatureOf(flats)).not.toBe(signatureOf(plots))
  })
})

describe('recordSearchDemand', () => {
  it('counts a zero-result search as unmet demand', async () => {
    recordSearchDemand(BENGALURU_VIEWPORT, { type: 'LAND' }, 0)
    await vi.waitFor(() => expect(prismaMock.searchDemand.upsert).toHaveBeenCalled())

    const call = prismaMock.searchDemand.upsert.mock.calls[0][0]
    expect(call.create.zeroResults).toBe(1)
    expect(call.update.zeroResults).toEqual({ increment: 1 })
  })

  it('counts a search that found something as met', async () => {
    recordSearchDemand(BENGALURU_VIEWPORT, {}, 12)
    await vi.waitFor(() => expect(prismaMock.searchDemand.upsert).toHaveBeenCalled())

    const call = prismaMock.searchDemand.upsert.mock.calls[0][0]
    expect(call.create.searches).toBe(1)
    expect(call.create.zeroResults).toBe(0)
    expect(call.create.lastResultCount).toBe(12)
  })

  it('does not record a search it cannot place on the map', async () => {
    recordSearchDemand(null, { type: 'LAND' }, 0)
    await new Promise((r) => setTimeout(r, 10))
    expect(prismaMock.searchDemand.upsert).not.toHaveBeenCalled()
  })

  it('never throws on the ASYNC path — a failed write must not break the map', async () => {
    prismaMock.searchDemand.upsert.mockRejectedValue(new Error('table missing'))
    expect(() => recordSearchDemand(BENGALURU_VIEWPORT, {}, 0)).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })

  it('never throws on the SYNC path either — this runs inside the pins query', () => {
    // demandShape is called synchronously by getPinsInBounds. A throw here would
    // blank the map, which is the product. Losing a demand row is a rounding
    // error, so the whole body is guarded, not just the write.
    const hostile = [
      { swLat: {}, swLng: [], neLat: 'x', neLng: null },
      Object.create(null),
      { swLat: NaN, swLng: NaN, neLat: NaN, neLng: NaN },
    ]
    for (const bounds of hostile) {
      expect(() => recordSearchDemand(bounds, { type: { nope: true } }, 0)).not.toThrow()
    }
    // And a filters object that is itself hostile.
    expect(() => recordSearchDemand(BENGALURU_VIEWPORT, null, 0)).not.toThrow()
  })
})

describe('getUnmetDemand — the readout', () => {
  // "tggj0" is not an area anybody can go and find a listing in (2026-08-23).
  // The cell's centre is named through the same boundary data the locality
  // pages use; the geohash stays on the row for the tooltip.
  it('names the cell from the ward that contains its centre, and fills a missing city', async () => {
    // tf31c is the cell around Velachery, Chennai (12.97N, 80.22E). A square around it.
    const square = (d) => ({
      type: 'Polygon',
      coordinates: [[[80.22 - d, 12.97 - d], [80.22 + d, 12.97 - d], [80.22 + d, 12.97 + d], [80.22 - d, 12.97 + d], [80.22 - d, 12.97 - d]]],
    })
    prismaMock.boundary.findMany.mockResolvedValue([
      { osmId: 1, name: 'Velachery', nameLocal: null, adminLevel: 10, geometry: square(0.1) },
      { osmId: 2, name: 'Chennai', nameLocal: null, adminLevel: 8, geometry: square(0.5) },
    ])
    prismaMock.searchDemand.groupBy.mockResolvedValue([
      { cellGeohash: 'tf31c', city: null, type: null, pricingModel: null, bhk: null, rentBand: null, _sum: { searches: 3, zeroResults: 3 } },
    ])
    prismaMock.searchDemand.aggregate.mockResolvedValue({ _sum: { searches: 3, zeroResults: 3 } })

    const out = await getUnmetDemand()

    expect(out.unmet[0]).toMatchObject({ cellGeohash: 'tf31c', area: 'Velachery', city: 'Chennai' })
  })

  it('leaves area null, never throws, when nothing covers the cell', async () => {
    prismaMock.boundary.findMany.mockResolvedValue([])
    prismaMock.searchDemand.groupBy.mockResolvedValue([
      { cellGeohash: 'zzzzz', city: 'Pune', type: null, pricingModel: null, bhk: null, rentBand: null, _sum: { searches: 1, zeroResults: 1 } },
    ])
    prismaMock.searchDemand.aggregate.mockResolvedValue({ _sum: { searches: 1, zeroResults: 1 } })

    const out = await getUnmetDemand()

    expect(out.unmet[0]).toMatchObject({ area: null, city: 'Pune' })
  })

  it('quotes the zero-result rate against ALL searches, not against the rows shown', async () => {
    prismaMock.searchDemand.groupBy.mockResolvedValue([
      {
        cellGeohash: 'tdr1y', city: 'Bengaluru', type: 'LAND',
        pricingModel: null, bhk: null, rentBand: null,
        _sum: { searches: 40, zeroResults: 40 },
      },
    ])
    prismaMock.searchDemand.aggregate.mockResolvedValue({
      _sum: { searches: 400, zeroResults: 60 },
    })

    const out = await getUnmetDemand({ days: 30 })

    expect(out.searches).toBe(400)
    expect(out.zeroResults).toBe(60)
    expect(out.zeroResultRate).toBe(15)
    expect(out.unmet).toHaveLength(1)
  })

  it('drops shapes that always found something — they are not an instruction', async () => {
    prismaMock.searchDemand.groupBy.mockResolvedValue([
      { cellGeohash: 'a', city: null, type: null, pricingModel: null, bhk: null, rentBand: null, _sum: { searches: 10, zeroResults: 0 } },
      { cellGeohash: 'b', city: null, type: null, pricingModel: null, bhk: null, rentBand: null, _sum: { searches: 5, zeroResults: 5 } },
    ])
    prismaMock.searchDemand.aggregate.mockResolvedValue({ _sum: { searches: 15, zeroResults: 5 } })

    const out = await getUnmetDemand()
    expect(out.unmet.map((u) => u.cellGeohash)).toEqual(['b'])
  })

  it('reports no rate rather than 0% when nothing has been recorded', async () => {
    prismaMock.searchDemand.aggregate.mockResolvedValue({ _sum: { searches: 0, zeroResults: 0 } })
    const out = await getUnmetDemand()
    // 0% would read as "we serve every search perfectly".
    expect(out.zeroResultRate).toBeNull()
  })
})
