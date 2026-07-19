import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { MODULES, modulesFor } from '../src/features/spatial/registry.js'
import { ALL_TYPES, RESIDENTIAL_TYPES, COMMUTE_TARGET } from '../src/features/spatial/propertyTypes.js'
import { buildEnvelope } from '../src/features/spatial/envelope.js'
import * as providers from '../src/features/spatial/providers.js'
import mobility from '../src/features/spatial/modules/mobility.module.js'
import commerce from '../src/features/spatial/modules/commerce.module.js'
import landContext from '../src/features/spatial/modules/landContext.module.js'
import pgContext from '../src/features/spatial/modules/pgContext.module.js'
import stayContext from '../src/features/spatial/modules/stayContext.module.js'

const CELL = { geohash: 'tdr1yf8', lat: 12.9784, lng: 77.6408, city: 'Bengaluru' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(0)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.spatialContext.findUnique.mockResolvedValue(null)
})

describe('module gating by property type', () => {
  it('gives every type at least a way to get there and something to breathe', () => {
    for (const type of ALL_TYPES) {
      const keys = modulesFor(type).map((m) => m.key)
      expect(keys, type).toContain('mobility')
      expect(keys, type).toContain('environment')
    }
  })

  // The bug that started this: a plot was being asked "could you live here
  // without a car?" and given a walkability score. Nobody lives on a plot.
  it('never asks a plot or a warehouse about walkability', () => {
    expect(modulesFor('LAND').map((m) => m.key)).not.toContain('lifestyle')
    expect(modulesFor('COMMERCIAL').map((m) => m.key)).not.toContain('lifestyle')
  })

  it('gives each specialist module to exactly one type', () => {
    const only = (key, type) => {
      for (const t of ALL_TYPES) {
        const has = modulesFor(t).some((m) => m.key === key)
        expect(has, `${key} for ${t}`).toBe(t === type)
      }
    }
    only('commerce', 'COMMERCIAL')
    only('pgContext', 'PG')
    only('stayContext', 'SHORT_STAY')
    only('landContext', 'LAND')
  })

  it('treats all four residential types identically', () => {
    const sets = RESIDENTIAL_TYPES.map((t) => modulesFor(t).map((m) => m.key).sort().join(','))
    expect(new Set(sets).size).toBe(1)
  })

  it('returns everything when no type is given (bare-coordinate lookups)', () => {
    expect(modulesFor(null)).toHaveLength(MODULES.length)
  })

  it('declares a commute target for every type — no silent fallback', () => {
    for (const type of ALL_TYPES) {
      expect(COMMUTE_TARGET[type], type).toBeTruthy()
    }
  })
})

describe('mobility — the drive means something different per type', () => {
  const dm = { trafficSeconds: 1800, freeFlowSeconds: 1200, distanceMeters: 12000 }

  it('sends a resident toward the employment centre', async () => {
    providers.distanceMatrix.mockResolvedValue(dm)
    const e = buildEnvelope(mobility, await mobility.compute({ ...CELL, propertyType: 'APARTMENT' }))
    expect(e.facts.find((f) => f.key === 'peak_drive_time').label).toMatch(/work area/i)
  })

  // Guests do not commute to a tech park. This was the concrete defect: every
  // type targeted the nearest IT corridor.
  it('sends a shop toward the city centre, not a tech park', async () => {
    providers.distanceMatrix.mockResolvedValue(dm)
    const e = buildEnvelope(mobility, await mobility.compute({ ...CELL, propertyType: 'COMMERCIAL' }))
    const drive = e.facts.find((f) => f.key === 'peak_drive_time')
    expect(drive.label).toMatch(/city centre/i)
    expect(drive.label).not.toMatch(/work area/i)
  })

  it('sends a holiday let toward the arrival point', async () => {
    providers.distanceMatrix.mockResolvedValue(dm)
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'airport', name: 'Kempegowda Intl', lat: 13.1986, lng: 77.7066 },
    ])
    const e = buildEnvelope(mobility, await mobility.compute({ ...CELL, propertyType: 'SHORT_STAY' }))
    expect(e.facts.find((f) => f.key === 'peak_drive_time').label).toMatch(/airport/i)
  })

  it('falls back to the city centre rather than inventing an arrival point', async () => {
    providers.distanceMatrix.mockResolvedValue(dm)
    prismaMock.poiIndex.count.mockResolvedValue(0) // nothing seeded
    const e = buildEnvelope(mobility, await mobility.compute({ ...CELL, propertyType: 'SHORT_STAY' }))
    expect(e.facts.find((f) => f.key === 'peak_drive_time').label).toMatch(/city centre/i)
  })
})

describe('commerce — a shopkeeper\'s questions, not a renter\'s', () => {
  it('never claims to measure footfall', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'retail', name: 'Shop', lat: 12.9786, lng: 77.6409 },
      { category: 'restaurant', name: 'Cafe', lat: 12.9785, lng: 77.6410 },
    ])
    const e = buildEnvelope(commerce, await commerce.compute(CELL))

    expect(e.missing.join(' ')).toMatch(/cannot tell you how many people walk past/i)
    // Density is a proxy and has to say so.
    expect(e.facts.find((f) => f.key === 'trade_density').method).toMatch(/proxy/i)
    expect(e.confidence.inputsMissing).toContain('footfall_measured')
  })

  it('admits parking is unknown rather than implying there is none', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    const e = buildEnvelope(commerce, await commerce.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/on-street parking is rarely mapped/i)
  })
})

describe('landContext — the boundary that matters most', () => {
  it('refuses to let a coordinate imply anything about title or approval', async () => {
    const e = buildEnvelope(landContext, await landContext.compute(CELL))
    const missing = e.missing.join(' ')
    expect(missing).toMatch(/title, patta, encumbrance or approval/i)
    expect(missing).toMatch(/sub-registrar/i)
    expect(missing).toMatch(/flood history is not available/i)
    expect(missing).toMatch(/water table/i)
  })

  it('caps confidence low — everything decisive here is legal or geotechnical', async () => {
    const e = buildEnvelope(landContext, await landContext.compute(CELL))
    expect(e.confidence.value).toBeLessThanOrEqual(0.5)
  })

  it('labels distance-from-centre as straight-line, not road distance', async () => {
    const e = buildEnvelope(landContext, await landContext.compute(CELL))
    expect(e.facts.find((f) => f.key === 'distance_from_city').method).toMatch(/not road distance/i)
  })
})

describe('pgContext — students, not families', () => {
  it('leads with night safety being unknown, because it is what they ask most', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    const e = buildEnvelope(pgContext, await pgContext.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/safe the walk home feels after dark/i)
    expect(e.confidence.inputsMissing).toContain('night_safety')
  })

  it('flags no walkable food as a real problem for a PG', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    const e = buildEnvelope(pgContext, await pgContext.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/no kitchen/i)
  })
})

describe('stayContext — guests, not tenants', () => {
  it('reports arrival points and admits night noise is unmeasurable', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'airport', name: 'Kempegowda Intl', lat: 13.1986, lng: 77.7066 },
      { category: 'attraction', name: 'Lalbagh', lat: 12.9800, lng: 77.6400 },
    ])
    const e = buildEnvelope(stayContext, await stayContext.compute(CELL))
    expect(e.facts.find((f) => f.key === 'airport_distance')).toBeDefined()
    expect(e.missing.join(' ')).toMatch(/no measured noise data/i)
  })
})

describe('getContext honours property type', () => {
  let service
  beforeEach(async () => {
    service = await vi.importActual('../src/features/spatial/spatial.service.js')
  })

  it('returns only the modules that type should see', async () => {
    const fresh = (key, version) => ({
      key, version, facts: [], confidence: { band: 'LOW' }, missing: [],
      staleAfter: new Date(Date.now() + 8.64e7).toISOString(),
    })
    prismaMock.spatialContext.findUnique.mockResolvedValue({
      geohash: 'tdr1yf8', city: 'Bengaluru', computedAt: new Date(), failCount: 0,
      modules: {
        // Mobility lives in a per-type slot; the others are shared.
        'mobility@COMMERCIAL': fresh('mobility', mobility.version),
        lifestyle: fresh('lifestyle', 3),
        commerce: fresh('commerce', 1),
        environment: fresh('environment', 2),
      },
    })

    const ctx = await service.getContext(12.9784, 77.6408, { propertyType: 'COMMERCIAL' })

    // Returned under the PLAIN key — the per-type slot is a storage detail the
    // frontend never sees. infrastructure applies to COMMERCIAL but has no
    // stored envelope here, so it is absent rather than empty.
    expect(Object.keys(ctx.modules).sort()).toEqual(['commerce', 'environment', 'mobility'])
    expect(ctx.modules.lifestyle).toBeUndefined()
  })

  // A cell warmed by an apartment has no `commerce` envelope. The first shop
  // listed there must top the cell up, not render a gap.
  it('tops up a cell that is missing this type\'s modules', async () => {
    prismaMock.spatialContext.findUnique.mockResolvedValue({
      geohash: 'tdr1yf8', city: 'Bengaluru', computedAt: new Date(), failCount: 0,
      modules: {
        'mobility@COMMERCIAL': {
          key: 'mobility', version: mobility.version, facts: [], confidence: { band: 'LOW' }, missing: [],
          staleAfter: new Date(Date.now() + 8.64e7).toISOString(),
        },
      },
    })

    await service.getContext(12.9784, 77.6408, { propertyType: 'COMMERCIAL', waitMs: 0 })

    // Materialisation was triggered despite the stored mobility module being
    // fresh. waitFor because the top-up is deliberately fire-and-forget — the
    // reader gets the partial cell now and the rest lands behind them.
    await vi.waitFor(() => expect(prismaMock.spatialContext.upsert).toHaveBeenCalled())
  })
})

// The bug this file's storage-slot design exists to prevent. A ground-floor
// shop and the flats above it share a ~153m cell, and mobility's destination
// differs between them — so a single `mobility` envelope per cell meant
// whichever listing materialised first silently won.
describe('a cell holding two property types', () => {
  let service
  beforeEach(async () => {
    service = await vi.importActual('../src/features/spatial/spatial.service.js')
  })

  it('keeps a separate mobility slot per type', () => {
    expect(service.storageKey(mobility, 'COMMERCIAL')).toBe('mobility@COMMERCIAL')
    expect(service.storageKey(mobility, 'APARTMENT')).toBe('mobility@APARTMENT')
    // A module whose answer doesn't depend on type stays in one shared slot —
    // that's what keeps the cell model cheap.
    expect(service.storageKey(commerce, 'COMMERCIAL')).toBe('commerce')
  })

  it('does not let a shop overwrite the flats\' mobility answer', async () => {
    providers.distanceMatrix.mockResolvedValue({ trafficSeconds: 900, freeFlowSeconds: 800, distanceMeters: 5000 })
    prismaMock.spatialContext.findUnique.mockResolvedValue({
      geohash: 'tdr1yf8', city: 'Bengaluru', failCount: 0, computedAt: new Date(),
      modules: {
        'mobility@APARTMENT': {
          key: 'mobility', version: mobility.version, facts: [], confidence: { value: 0.5 }, missing: [],
          staleAfter: new Date(Date.now() + 8.64e7).toISOString(),
        },
      },
    })

    await service.materialize('tdr1yf8', 'COMMERCIAL')

    const written = prismaMock.spatialContext.upsert.mock.calls[0][0].update.modules
    expect(written['mobility@APARTMENT']).toBeDefined()
    expect(written['mobility@COMMERCIAL']).toBeDefined()
  })

  it('prunes an orphaned envelope left by a module changing storage shape', async () => {
    providers.distanceMatrix.mockResolvedValue(null)
    prismaMock.spatialContext.findUnique.mockResolvedValue({
      geohash: 'tdr1yf8', city: 'Bengaluru', failCount: 0, computedAt: new Date(),
      // The pre-fix shape: mobility stored under its plain key. Nothing reads
      // it now, so it must not linger in the JSON forever.
      modules: { mobility: { key: 'mobility', version: 1, facts: [], confidence: {}, missing: [] } },
    })

    await service.materialize('tdr1yf8', 'APARTMENT')

    const written = prismaMock.spatialContext.upsert.mock.calls[0][0].update.modules
    expect(written.mobility).toBeUndefined()
    expect(written['mobility@APARTMENT']).toBeDefined()
  })
})
