import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { buildEnvelope } from '../src/features/spatial/envelope.js'
import {
  walkMinutes, walkDisplay, describeProximity, formatDistance,
  MAX_WALK_PHRASE_M, WALK_METHOD,
} from '../src/features/spatial/proximity.js'
import { listPoisNear, cityCategoryCoverage } from '../src/features/spatial/poiProvider.js'
import infrastructure from '../src/features/spatial/modules/infrastructure.module.js'
import lifestyle from '../src/features/spatial/modules/lifestyle.module.js'

const CELL = { geohash: 'tdr1yf8', lat: 12.9784, lng: 77.6408, city: 'Bengaluru' }

// Rows the bbox query would return for a point right at CELL — distances of a
// few hundred metres via tiny lat offsets (1e-3 deg ≈ 111 m).
const poiRow = (category, name, dLat = 0.001, extra = {}) => ({
  category, name, lat: CELL.lat + dLat, lng: CELL.lng, brand: null, openingHours: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(0)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.poiIndex.groupBy.mockResolvedValue([])
})

// ── The shared vocabulary ────────────────────────────────────────────────────

describe('proximity helpers', () => {
  it('never claims a zero-minute walk', () => {
    expect(walkMinutes(10)).toBe(1)
  })

  it('matches its own declared method — 800 m is ~13 min, not "10 minutes"', () => {
    // 800 × 1.35 / 4800 × 60 = 13.5 → 14. The phrasing bug this guards
    // against: modules hand-writing "a 10-minute walk" for 800 m.
    expect(walkMinutes(800)).toBe(14)
  })

  it('phrases a walk only while calling it a walk is honest', () => {
    expect(walkDisplay(MAX_WALK_PHRASE_M)).toMatch(/min walk/)
    expect(walkDisplay(MAX_WALK_PHRASE_M + 1)).not.toMatch(/walk/)
    expect(walkDisplay(2300)).toBe('2.3 km away')
  })

  it('keeps the measured distance visible alongside the time', () => {
    // 420 × 1.35 / 4800 × 60 = 7.09 → 7
    expect(walkDisplay(420)).toBe('about a 7 min walk (420 m)')
  })

  it('grades proximity into bands rather than fake precision', () => {
    expect(describeProximity(90)).toBe('just around the corner')
    expect(describeProximity(400)).toBe('a short walk away')
    expect(describeProximity(1000)).toBe('within walking distance')
    expect(describeProximity(2000)).toBe('a quick ride away')
    expect(describeProximity(4000)).toBe('4.0 km away')
  })

  it('humanises metres past a kilometre', () => {
    expect(formatDistance(950)).toBe('950 m')
    expect(formatDistance(12563)).toBe('12.6 km')
  })
})

// ── The named-list provider behind GET /spatial/pois ─────────────────────────

describe('listPoisNear', () => {
  it('reports unavailable for an unseeded city — "not loaded", never "nothing here"', async () => {
    const r = await listPoisNear(CELL.lat, CELL.lng, ['bank'], 2000, CELL.city)
    expect(r.available).toBe(false)
    expect(r.pois).toEqual([])
  })

  it('returns named rows sorted nearest-first with OSM extras when present', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      poiRow('bank', 'Canara Bank', 0.004),
      poiRow('bank', 'ICICI ATM', 0.001, { brand: 'ICICI Bank', openingHours: '24/7' }),
    ])

    const r = await listPoisNear(CELL.lat, CELL.lng, ['bank'], 2000, CELL.city)
    expect(r.available).toBe(true)
    expect(r.pois.map((p) => p.name)).toEqual(['ICICI ATM', 'Canara Bank'])
    expect(r.pois[0].brand).toBe('ICICI Bank')
    expect(r.pois[0].openingHours).toBe('24/7')
    expect(r.pois[0].distanceM).toBeLessThan(r.pois[1].distanceM)
  })

  it('trims bbox corners to a true radius', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      poiRow('bank', 'Inside', 0.001),
      poiRow('bank', 'Corner artefact', 0.03), // ~3.3 km — inside the bbox for a 2 km radius, outside the circle
    ])

    const r = await listPoisNear(CELL.lat, CELL.lng, ['bank'], 2000, CELL.city)
    expect(r.pois.map((p) => p.name)).toEqual(['Inside'])
  })

  it('caps the list but reports the honest total', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue(
      Array.from({ length: 150 }, (_, i) => poiRow('restaurant', `Place ${i}`, 0.0001 * (i + 1)))
    )

    const r = await listPoisNear(CELL.lat, CELL.lng, ['restaurant'], 2000, CELL.city)
    expect(r.pois.length).toBe(100)
    expect(r.total).toBe(150)
    expect(r.truncated).toBe(true)
  })
})

// ── Coverage gating for post-seed vocabulary ─────────────────────────────────

describe('cityCategoryCoverage gating', () => {
  it('drops police/fire with a "not loaded yet" note when the seed predates them', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500) // city IS seeded…
    prismaMock.poiIndex.groupBy.mockResolvedValue([
      { category: 'bank', _count: { _all: 200 } },   // …but only with old categories
    ])
    prismaMock.poiIndex.findMany.mockResolvedValue([poiRow('bank', 'SBI', 0.002)])

    const e = buildEnvelope(infrastructure, await infrastructure.compute(CELL))

    expect(e.facts.some((f) => f.key === 'nearest_police')).toBe(false)
    expect(e.facts.some((f) => f.key === 'nearest_fire_station')).toBe(false)
    expect(e.missing.join(' ')).toMatch(/haven't been loaded for this city yet/i)
  })

  it('renders police normally once the category is seeded', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.groupBy.mockResolvedValue([
      { category: 'police', _count: { _all: 40 } },
      { category: 'fire_station', _count: { _all: 12 } },
    ])
    prismaMock.poiIndex.findMany.mockResolvedValue([
      poiRow('police', 'Indiranagar Police Station', 0.003),
    ])

    const e = buildEnvelope(infrastructure, await infrastructure.compute(CELL))
    const police = e.facts.find((f) => f.key === 'nearest_police')
    expect(police).toBeTruthy()
    expect(police.count).toBe(1)
    expect(e.confidence.inputsPresent).toContain('poi_civic_safety')
  })

  it('returns {} rather than throwing when the query fails', async () => {
    prismaMock.poiIndex.groupBy.mockRejectedValue(new Error('db down'))
    expect(await cityCategoryCoverage('Bengaluru')).toEqual({})
  })
})

// ── Walk phrasing + counts flow through to the envelope ──────────────────────

describe('human-readable facts', () => {
  it('lifestyle facts carry a walk time, the measured distance, and a machine-readable count', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      poiRow('supermarket', 'More Megastore', 0.002),      // ~222 m
      poiRow('supermarket', 'Ratnadeep', 0.005),           // ~555 m
    ])

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    const groceries = e.facts.find((f) => f.key === 'nearest_supermarket')

    expect(groceries.display).toMatch(/about a \d+ min walk \(\d+ m\)/)
    expect(groceries.display).toMatch(/2 within 1\.6 km/)
    expect(groceries.count).toBe(2)
    expect(groceries.value).toBe(222) // the VALUE stays the measured metres
  })

  it('healthcare merges hospitals and clinics under one fact', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      poiRow('hospital', 'Manipal', 0.009),
      poiRow('clinic', 'Apollo Clinic', 0.002), // closer — must win "nearest"
    ])

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    const care = e.facts.find((f) => f.key === 'nearest_hospital')
    expect(care.count).toBe(2)
    expect(care.value).toBe(222)
  })

  it('the walk conversion is disclosed via the declared method string', () => {
    expect(WALK_METHOD).toMatch(/1\.35/)
    expect(WALK_METHOD).toMatch(/4\.8 km\/h/)
  })

  it('sparse mapping is carried structurally on the envelope, not only as prose', async () => {
    prismaMock.poiIndex.count.mockResolvedValue(500)
    prismaMock.poiIndex.findMany.mockResolvedValue([poiRow('supermarket', 'Lone shop', 0.002)])

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    expect(e.sparselyMapped).toBe(true) // 1 POI total < the sparse threshold
  })
})
