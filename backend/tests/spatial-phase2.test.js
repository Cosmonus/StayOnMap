import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { PROVENANCE, STATUS, buildEnvelope } from '../src/features/spatial/envelope.js'
import * as providers from '../src/features/spatial/providers.js'
// Mocked because it is a NETWORK provider: landCover() range-reads a GeoTIFF
// from S3. Left real, these tests would hit the internet, take seconds, and
// pass or fail on someone else's uptime — the same trap the water tests fell
// into with elevation.
vi.mock('../src/features/spatial/worldCoverProvider.js', () => ({
  landCover: vi.fn(async () => null),
  SAMPLE_RADIUS_M: 500,
  WORLDCOVER_SOURCE: { id: 'esa-worldcover', label: 'ESA WorldCover', licence: 'CC-BY 4.0' },
}))
const { landCover } = await import('../src/features/spatial/worldCoverProvider.js')
import environment from '../src/features/spatial/modules/environment.module.js'
import lifestyle from '../src/features/spatial/modules/lifestyle.module.js'
import infrastructure from '../src/features/spatial/modules/infrastructure.module.js'
import { poisNear, poiCoverage } from '../src/features/spatial/poiProvider.js'
import { runRefreshTick } from '../src/features/spatial/refresher.js'
import { materialize } from '../src/features/spatial/spatial.service.js'
import { categoryFor, overpassClauses } from '../src/features/spatial/poiCategories.js'
import mobilityModule from '../src/features/spatial/modules/mobility.module.js'

const mobilityVersion = mobilityModule.version

const CELL = { geohash: 'tdr1yf8', lat: 12.9784, lng: 77.6408, city: 'Bengaluru' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(0)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.spatialContext.findMany.mockResolvedValue([])
})

// ── Environment ─────────────────────────────────────────────────────────────

describe('environment module', () => {
  const AQ = {
    currentPm25: 147.1, currentPm10: 210.4,
    medianPm25: 85.4, p90Pm25: 159.7, sampleCount: 2310,
  }

  it('labels modelled air quality as ESTIMATED, never as a measurement', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    const e = buildEnvelope(environment, await environment.compute(CELL))

    const now = e.facts.find((f) => f.key === 'pm25_now')
    expect(now.provenance).toBe(PROVENANCE.ESTIMATED)
    expect(now.method).toMatch(/not a reading from a monitoring station/i)
  })

  it('reports the 90-day pattern, not just today — Indian air quality is seasonal', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    const e = buildEnvelope(environment, await environment.compute(CELL))

    expect(e.facts.find((f) => f.key === 'pm25_typical').value).toBe(85.4)
    expect(e.facts.find((f) => f.key === 'pm25_bad_days').value).toBe(159.7)
    // The sample size is what makes a percentile meaningful rather than decorative.
    expect(e.facts.find((f) => f.key === 'pm25_bad_days').method).toMatch(/2310/)
  })

  it('uses CPCB bands, not the US EPA scale — this is an India product', async () => {
    providers.airQuality.mockResolvedValue({ ...AQ, currentPm25: 45, medianPm25: 45, p90Pm25: 45 })
    const e = buildEnvelope(environment, await environment.compute(CELL))
    // 45 µg/m³ is "Satisfactory" on CPCB's scale; US EPA would call it "Moderate".
    expect(e.facts.find((f) => f.key === 'pm25_now').display).toMatch(/Satisfactory/)
  })

  it('caps confidence — the headline facts are still model output', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    const e = buildEnvelope(environment, await environment.compute(CELL))
    // Ceiling raised 0.60 -> 0.75 on 2026-07-28 when CPCB readings and
    // WorldCover both landed, which is the condition the module's own comment
    // set for raising it. Not 1.0: what this module LEADS with is still
    // modelled air quality.
    expect(e.confidence.value).toBeLessThanOrEqual(0.75)
    expect(e.confidence.inputsMissing).toEqual(
      expect.arrayContaining(['cpcb_station', 'tree_cover', 'water_distance'])
    )
  })

  it('survives a failed air-quality read when another input is alive', async () => {
    // The Chennai defect. One upstream hiccup used to take the whole module
    // down via the early return, leaving a production cell at "0 of 4 inputs"
    // while Open-Meteo answered that coordinate fine.
    providers.airQuality.mockResolvedValue(null)
    landCover.mockResolvedValueOnce({
      treePct: 16.1, greenPct: 16.8, builtPct: 80.3, waterPct: 0.5,
      samplePx: 10000, radiusM: 500, clipped: false,
    })
    const e = buildEnvelope(environment, await environment.compute(CELL))

    expect(e.status).not.toBe(STATUS.UNAVAILABLE)
    expect(e.confidence.inputsPresent).toContain('tree_cover')
    expect(e.missing.join(' ')).toMatch(/air quality data was unavailable/i)
  })

  it('labels tree cover ESTIMATED — a classifier read imagery, it did not count trees', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    landCover.mockResolvedValueOnce({
      treePct: 67.2, greenPct: 68.7, builtPct: 30.8, waterPct: 0.1,
      samplePx: 10000, radiusM: 500, clipped: false,
    })
    const e = buildEnvelope(environment, await environment.compute(CELL))
    const tree = e.facts.find((f) => f.key === 'tree_cover')

    expect(tree.provenance).toBe(PROVENANCE.ESTIMATED)
    expect(tree.method).toMatch(/classifier read satellite imagery|not a count of trees/i)
    // Built-up share is what makes the tree figure legible.
    expect(tree.display).toMatch(/30.8% is built on/)
  })

  it('says noise is unavailable because it cannot be measured, not because it was skipped', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    const e = buildEnvelope(environment, await environment.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/no measured noise data exists/i)
  })

  it('never emits a heat fact — a city-wide temperature is not local information', async () => {
    providers.airQuality.mockResolvedValue(AQ)
    const e = buildEnvelope(environment, await environment.compute(CELL))
    expect(e.facts.some((f) => /heat|temperature/i.test(f.key))).toBe(false)
  })

  it('degrades to UNAVAILABLE with an explanation when EVERY input is down', async () => {
    // Still the right outcome when nothing at all answered — what changed on
    // 2026-07-28 is that one dead upstream no longer counts as all of them.
    providers.airQuality.mockResolvedValue(null)
    landCover.mockResolvedValue(null)
    const e = buildEnvelope(environment, await environment.compute(CELL))
    expect(e.status).toBe(STATUS.UNAVAILABLE)
    expect(e.missing.length).toBeGreaterThan(0)
    // And now says WHICH upstream, so an empty card is diagnosable from the
    // payload rather than only from the box.
    expect(e.unavailableReason).toMatch(/upstream failure/i)
  })
})

// ── POI provider ────────────────────────────────────────────────────────────

describe('poiProvider', () => {
  it('reports unavailable when the city has not been seeded', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(0)
    const r = await poisNear(12.9784, 77.6408, 1600, ['pharmacy'], 'Bengaluru')
    // Crucially NOT an empty result set — "not seeded" and "nothing nearby"
    // are different claims and only one is supportable.
    expect(r.available).toBe(false)
  })

  it('trims the bounding box down to a true radius', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'pharmacy', name: 'Close', lat: 12.9790, lng: 77.6408 },   // ~65m
      // Inside the bbox corner but outside the circle — the whole reason the
      // haversine pass exists.
      { category: 'pharmacy', name: 'Corner', lat: 12.9928, lng: 77.6555 },  // ~2.2km
    ])

    const r = await poisNear(12.9784, 77.6408, 1600, ['pharmacy'], 'Bengaluru')
    expect(r.available).toBe(true)
    expect(r.byCategory.pharmacy).toHaveLength(1)
    expect(r.byCategory.pharmacy[0].name).toBe('Close')
  })

  it('sorts each category nearest-first', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'bank', name: 'Far', lat: 12.9840, lng: 77.6408 },
      { category: 'bank', name: 'Near', lat: 12.9788, lng: 77.6408 },
    ])
    const r = await poisNear(12.9784, 77.6408, 1600, ['bank'], 'Bengaluru')
    expect(r.byCategory.bank.map((p) => p.name)).toEqual(['Near', 'Far'])
  })

  it('flags a sparsely-mapped area rather than calling it empty', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'bank', name: 'Only one', lat: 12.9788, lng: 77.6408 },
    ])
    const r = await poisNear(12.9784, 77.6408, 1600, ['bank'], 'Bengaluru')
    expect(r.sparselyMapped).toBe(true)
  })

  it('survives a database error without throwing into the module', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockRejectedValue(new Error('connection lost'))
    await expect(poisNear(12.97, 77.64, 1600, ['bank'], 'Bengaluru')).resolves.toMatchObject({ available: false })
  })

  it('treats a missing city as unseeded', async () => {
    expect(await poiCoverage(null)).toBe(0)
  })
})

// ── Lifestyle sourcing ──────────────────────────────────────────────────────

describe('lifestyle module sourcing', () => {
  it('prefers the self-hosted table and never calls Google when seeded', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'supermarket', name: 'Shop', lat: 12.9788, lng: 77.6408 },
      { category: 'pharmacy', name: 'Chemist', lat: 12.9790, lng: 77.6410 },
      { category: 'hospital', name: 'Clinic', lat: 12.9800, lng: 77.6420 },
      ...Array.from({ length: 12 }, (_, i) => ({
        category: 'restaurant', name: `R${i}`, lat: 12.9786 + i * 0.0001, lng: 77.6409,
      })),
    ])

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))

    expect(providers.nearbyPlaces).not.toHaveBeenCalled()
    expect(e.facts.find((f) => f.key === 'nearest_supermarket').source).toBe('osm-poi')
    // Only the self-hosted path can answer "is this area well mapped?".
    expect(e.confidence.inputsPresent).toContain('poi_density_baseline')
  })

  it('falls back to Google when the table is empty', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(0)
    providers.nearbyPlaces.mockResolvedValue([{ name: 'X', lat: 12.9788, lng: 77.6408 }])

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))

    expect(providers.nearbyPlaces).toHaveBeenCalled()
    expect(e.facts.find((f) => f.key === 'nearest_supermarket').source).toBe('google-places')
    // Google can't tell a thin map from a thin area, so this input stays absent
    // and the fallback path is correctly less confident.
    expect(e.confidence.inputsPresent).not.toContain('poi_density_baseline')
  })

  it('warns that a thin count may be the map, not the area', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'bank', name: 'Bank', lat: 12.9788, lng: 77.6408 },
    ])
    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/lightly mapped/i)
  })

  it('publishes the walkability formula rather than presenting a bare score', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'supermarket', name: 'Shop', lat: 12.9788, lng: 77.6408 },
    ])
    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    const w = e.facts.find((f) => f.key === 'walkability')
    expect(w.method).toMatch(/400 m/)
    expect(w.method).toMatch(/groceries and pharmacy count triple/)
  })
})

// ── Infrastructure ──────────────────────────────────────────────────────────

describe('infrastructure module', () => {
  it('always says internet speed is unavailable rather than quoting a city average', async () => {
    const e = buildEnvelope(infrastructure, await infrastructure.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/no free per-location\s+internet performance data/i)
    expect(e.facts.some((f) => /internet|speed|broadband/i.test(f.key))).toBe(false)
    expect(e.confidence.inputsMissing).toContain('internet_speed')
  })

  it('distinguishes "no EV chargers mapped" from "no EV chargers exist"', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'bank', name: 'Bank', lat: 12.9788, lng: 77.6408 },
      { category: 'atm', name: 'ATM', lat: 12.9789, lng: 77.6409 },
    ])
    const e = buildEnvelope(infrastructure, await infrastructure.compute(CELL))
    expect(e.missing.join(' ')).toMatch(/does not mean none exist/i)
  })
})

// ── Refresher ───────────────────────────────────────────────────────────────

describe('refresher', () => {
  it('refreshes the stalest cells first', async () => {
    prismaMock.spatialContext.findMany.mockResolvedValue([
      { geohash: 'aaa1111' }, { geohash: 'bbb2222' },
    ])

    const result = await runRefreshTick()

    expect(result.refreshed).toBe(2)
    expect(materialize).toHaveBeenCalledWith('aaa1111')
    expect(materialize).toHaveBeenCalledWith('bbb2222')
    expect(prismaMock.spatialContext.findMany.mock.calls[0][0].orderBy).toEqual({ staleAfter: 'asc' })
  })

  it('skips cells that keep failing, so one broken cell cannot eat every tick', async () => {
    await runRefreshTick()
    const where = prismaMock.spatialContext.findMany.mock.calls[0][0].where
    expect(where.failCount).toEqual({ lt: 5 })
  })

  it('bounds work per tick so it cannot drain the daily API budget at once', async () => {
    await runRefreshTick()
    expect(prismaMock.spatialContext.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(10)
  })

  it('does nothing when no cell is due', async () => {
    const result = await runRefreshTick()
    expect(result.refreshed).toBe(0)
    expect(materialize).not.toHaveBeenCalled()
  })

  it('reports failure instead of throwing into the interval', async () => {
    prismaMock.spatialContext.findMany.mockRejectedValue(new Error('db down'))
    await expect(runRefreshTick()).resolves.toMatchObject({ error: true })
  })
})

// ── Cold-start contract ─────────────────────────────────────────────────────
// The real service, not the global mock from tests/setup.js. A cell nobody has
// computed yet must be reported as "not yet", never as "nothing here" — an
// empty section under a confident heading makes the second claim.
describe('getContext cold start', () => {
  let service

  beforeEach(async () => {
    service = await vi.importActual('../src/features/spatial/spatial.service.js')
  })

  it('reports pending rather than null when the cell has never been computed', async () => {
    prismaMock.spatialContext.findUnique.mockResolvedValue(null)

    const ctx = await service.getContext(12.9784, 77.6408, { waitMs: 0 })

    expect(ctx).not.toBeNull()
    expect(ctx.pending).toBe(true)
    expect(ctx.modules).toBeNull()
    // Still resolves the city, so the UI can name the area while it waits.
    expect(ctx.city).toBe('Bengaluru')
  })

  // A boolean can express two outcomes; there are four (ready / pending /
  // failed / nothing-mapped). Before `status`, the panel collapsed the last
  // three into one bare heading with no cards and no explanation — the exact
  // "empty card" symptom seen in production. `pending` stays alongside it for
  // released mobile builds that already read it.
  it('carries a status the client can branch on, alongside the legacy pending flag', async () => {
    prismaMock.spatialContext.findUnique.mockResolvedValue(null)

    const cold = await service.getContext(12.9784, 77.6408, { waitMs: 0 })
    expect(cold.status).toBe(service.STATUS_PENDING)
    expect(cold.pending).toBe(true)
  })

  it('returns stored modules for a warm cell and does not mark them pending', async () => {
    prismaMock.spatialContext.findUnique.mockResolvedValue({
      geohash: 'tdr1yf8', city: 'Bengaluru',
      // Stored under the per-type slot: mobility's destination varies by type,
      // so its envelope can't be shared across types. '@ANY' is the slot used
      // when no type is given. See storageKey() in spatial.service.js.
      modules: {
        'mobility@ANY': {
          key: 'mobility', version: mobilityVersion,
          staleAfter: new Date(Date.now() + 8.64e7).toISOString(),
        },
      },
      computedAt: new Date(), staleAfter: new Date(Date.now() + 8.64e7), failCount: 0,
    })

    const ctx = await service.getContext(12.9784, 77.6408)
    expect(ctx.pending).toBe(false)
    expect(ctx.status).toBe(service.STATUS_READY)
    expect(ctx.modules.mobility).toBeDefined()
  })

  it('does not schedule work when the caller opts out', async () => {
    prismaMock.spatialContext.findUnique.mockResolvedValue(null)

    // Drain first, then clear.
    //
    // getContext schedules materialisation FIRE-AND-FORGET, so an earlier test
    // in this file returns before its background write lands. That write then
    // resolves against the shared prismaMock partway through this test and
    // trips the assertion below — a ~1-in-3 failure that passes in isolation
    // and looks like a bug in the code under test rather than in the harness.
    //
    // The alternative fixes are worse: awaiting the background work would test
    // something other than what those tests are about, and asserting a delta
    // still races. This is the honest shape of the constraint.
    await new Promise((resolve) => setTimeout(resolve, 50))
    prismaMock.spatialContext.upsert.mockClear()

    const ctx = await service.getContext(12.9784, 77.6408, { materializeIfMissing: false })
    expect(ctx).toBeNull()
    expect(prismaMock.spatialContext.upsert).not.toHaveBeenCalled()
  })
})

// ── POI category mapping ────────────────────────────────────────────────────

describe('poiCategories', () => {
  it('maps OSM tags onto the layer vocabulary', () => {
    expect(categoryFor({ amenity: 'pharmacy' })).toBe('pharmacy')
    expect(categoryFor({ shop: 'supermarket' })).toBe('supermarket')
    expect(categoryFor({ leisure: 'park' })).toBe('park')
    expect(categoryFor({ highway: 'bus_stop' })).toBe('bus_stop')
    expect(categoryFor({ office: 'government' })).toBe('government')
  })

  it('drops anything outside the vocabulary rather than force-fitting it', () => {
    expect(categoryFor({ amenity: 'bench' })).toBeNull()
    expect(categoryFor({})).toBeNull()
  })

  it('builds an Overpass union query covering every category at once', () => {
    const q = overpassClauses({ south: 12.9, west: 77.5, north: 13.0, east: 77.6 })
    expect(q).toMatch(/nwr\["amenity"/)
    expect(q).toMatch(/pharmacy/)
    expect(q).toMatch(/supermarket/)
    // nwr, not node — many Indian POIs are mapped as building polygons, and
    // querying only nodes would silently lose hospitals, schools and malls.
    expect(q).not.toMatch(/^node\["amenity"/m)
    expect(q).toMatch(/12\.9,77\.5,13,77\.6/)
  })
})
