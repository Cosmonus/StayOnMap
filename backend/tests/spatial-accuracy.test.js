// Regression suite for the 2026-07-19 spatial accuracy audit.
//
// Each block guards a defect that shipped: an unreachable category (fast_food
// swallowed by restaurant), node/way double-counting, an un-ordered bbox slice
// that could drop the true nearest POI, cell-centre distances served to
// properties at the cell edge, and a sparse-mapping threshold that ignored the
// search area. None of these had a test before — which is how they shipped.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { POI_CATEGORIES, CATEGORY_KEYS, categoryFor } from '../src/features/spatial/poiCategories.js'
import {
  poisNear, dedupeCategory, pickNearest, sparseThreshold,
} from '../src/features/spatial/poiProvider.js'
import { reanchorFact, reanchorModules } from '../src/features/spatial/reanchor.js'
import { fact, PROVENANCE } from '../src/features/spatial/envelope.js'
import { haversineMeters } from '../src/lib/geohash.js'

const LAT = 12.9784
const LNG = 77.6408

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(5000)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.poiIndex.aggregate.mockResolvedValue({ _max: { fetchedAt: null } })
})

// ── Category mapping ────────────────────────────────────────────────────────

describe('poiCategories reachability', () => {
  it('every declared tag mapping is actually reachable (first-match-wins cannot shadow)', () => {
    // The fast_food bug: restaurant listed it first, so food_cheap could never
    // match and pgContext's cheap-eats signal was silently dead. This walks
    // EVERY (tagKey, value) pair and asserts it resolves to the category that
    // declares it — any future collision fails here by construction.
    for (const [category, rules] of Object.entries(POI_CATEGORIES)) {
      for (const [tagKey, values] of Object.entries(rules)) {
        for (const value of values) {
          expect(
            { pair: `${tagKey}=${value}`, resolvesTo: categoryFor({ [tagKey]: value }) }
          ).toEqual({ pair: `${tagKey}=${value}`, resolvesTo: category })
        }
      }
    }
  })

  it('fast_food is cheap food, not a restaurant', () => {
    expect(categoryFor({ amenity: 'fast_food' })).toBe('food_cheap')
    expect(categoryFor({ amenity: 'restaurant' })).toBe('restaurant')
    expect(categoryFor({ amenity: 'food_court' })).toBe('food_cheap')
  })

  it('keeps the vocabulary and the seed script agreeing on category keys', () => {
    expect(CATEGORY_KEYS).toContain('food_cheap')
    expect(CATEGORY_KEYS).toContain('restaurant')
  })
})

// ── Deduplication ───────────────────────────────────────────────────────────

describe('dedupeCategory', () => {
  const poi = (name, dLatM, extra = {}) => ({
    name,
    brand: null,
    distanceM: Math.round(dLatM),
    lat: LAT + dLatM / 111_320,
    lng: LNG,
    ...extra,
  })

  it('collapses the same named place mapped twice (node + building way)', () => {
    const kept = dedupeCategory([poi('Apollo Pharmacy', 100), poi('Apollo Pharmacy', 180)])
    expect(kept).toHaveLength(1)
    expect(kept[0].distanceM).toBe(100) // nearest copy wins
  })

  it('collapses an unnamed point sitting on top of a kept place', () => {
    const kept = dedupeCategory([poi('State Bank', 100), poi(null, 115)])
    expect(kept).toHaveLength(1)
  })

  it('keeps two genuinely different places at similar distance', () => {
    const kept = dedupeCategory([poi('HDFC Bank', 100), poi('ICICI Bank', 130)])
    expect(kept).toHaveLength(2)
  })

  it('keeps same-name places far apart — a chain has real branches', () => {
    const kept = dedupeCategory([poi('Apollo Pharmacy', 100), poi('Apollo Pharmacy', 900)])
    expect(kept).toHaveLength(2)
  })

  it('matches on brand when the name tag is bare', () => {
    const kept = dedupeCategory([
      poi(null, 100, { brand: 'ICICI' }),
      poi(null, 120, { brand: 'ICICI' }),
    ])
    expect(kept).toHaveLength(1)
  })
})

describe('pickNearest', () => {
  it('prefers a named place when one is comparably close to an anonymous point', () => {
    const hits = [
      { name: null, distanceM: 200, lat: LAT, lng: LNG },
      { name: 'Apollo Pharmacy', distanceM: 300, lat: LAT, lng: LNG },
    ]
    expect(pickNearest(hits).name).toBe('Apollo Pharmacy')
  })

  it('keeps the anonymous nearest when nothing named is comparably close', () => {
    const hits = [
      { name: null, distanceM: 200, lat: LAT, lng: LNG },
      { name: 'Apollo Pharmacy', distanceM: 900, lat: LAT, lng: LNG },
    ]
    expect(pickNearest(hits).name).toBeNull()
  })

  it('handles empty input', () => {
    expect(pickNearest([])).toBeNull()
    expect(pickNearest(undefined)).toBeNull()
  })
})

// ── Exhaustive bbox scan ────────────────────────────────────────────────────

describe('poisNear exhaustive scan', () => {
  it('pages past the first slice so density cannot hide the true nearest', async () => {
    // The old implementation took an UN-ordered 2000-row slice; in a dense
    // cell the true nearest POI could sit outside it. The nearest hospital
    // here arrives on the SECOND page — it must still win.
    const fullPage = Array.from({ length: 2000 }, (_, i) => ({
      id: `a${i}`, category: 'hospital', name: `H${i}`, brand: null,
      lat: LAT + 0.005 + i * 1e-7, lng: LNG,
    }))
    const secondPage = [
      { id: 'zzz', category: 'hospital', name: 'Closest Hospital', brand: null, lat: LAT + 0.0001, lng: LNG },
    ]
    prismaMock.poiIndex.findMany
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce(secondPage)

    const r = await poisNear(LAT, LNG, 1600, ['hospital'], 'Bengaluru')

    expect(prismaMock.poiIndex.findMany).toHaveBeenCalledTimes(2)
    expect(r.byCategory.hospital[0].name).toBe('Closest Hospital')
    expect(r.truncated).toBe(false)
  })

  it('orders and cursors the scan so pages are deterministic', async () => {
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    await poisNear(LAT, LNG, 1600, ['bank'], 'Bengaluru')
    const args = prismaMock.poiIndex.findMany.mock.calls[0][0]
    expect(args.orderBy).toEqual({ id: 'asc' })
    expect(args.take).toBeGreaterThan(0)
  })
})

// ── Sparse threshold is area-normalized ─────────────────────────────────────

describe('sparseThreshold', () => {
  it('scales with the searched area instead of using one fixed count', () => {
    // The old fixed 12 fired almost always at 300 m and almost never at 5 km.
    expect(sparseThreshold(300)).toBeLessThan(sparseThreshold(1600))
    expect(sparseThreshold(1600)).toBeLessThan(sparseThreshold(5000))
  })

  it('keeps the historical bar at the lifestyle radius', () => {
    // 1.5/km² over a 1.6 km circle ≈ the old 12 — same sensitivity where it
    // was calibrated, corrected everywhere else.
    expect(sparseThreshold(1600)).toBeGreaterThanOrEqual(10)
    expect(sparseThreshold(1600)).toBeLessThanOrEqual(14)
  })

  it('never drops below a floor small areas can actually meet', () => {
    expect(sparseThreshold(100)).toBeGreaterThanOrEqual(3)
  })
})

// ── Read-time re-anchoring ──────────────────────────────────────────────────

describe('reanchor', () => {
  // A pharmacy 500 m north of the cell centre; the property is 100 m north of
  // the centre, so its true distance is ~400 m.
  const pharmacy = { lat: LAT + 500 / 111_320, lng: LNG }
  const property = { lat: LAT + 100 / 111_320, lng: LNG }

  const storedFact = () => fact({
    key: 'nearest_pharmacy',
    label: 'Pharmacy',
    value: 500,
    unit: 'm',
    display: 'about a 8 min walk (500 m) · 3 within 1.6 km',
    provenance: PROVENANCE.DERIVED,
    source: 'osm-poi',
    count: 3,
    at: pharmacy,
    place: 'Apollo Pharmacy',
    withinM: 1600,
  })

  it('re-derives the distance from the property, not the cell centre', () => {
    const f = reanchorFact(storedFact(), property.lat, property.lng)
    const expected = Math.round(haversineMeters(property.lat, property.lng, pharmacy.lat, pharmacy.lng))
    expect(f.value).toBe(expected)
    expect(Math.abs(f.value - 400)).toBeLessThanOrEqual(2)
    expect(f.display).toContain('Apollo Pharmacy')
    expect(f.display).toContain('3 within 1.6 km')
  })

  it('recomputes walk-time facts in minutes', () => {
    const walk = fact({
      key: 'walk_time_metro', label: 'Walk to metro', value: 8, unit: 'min',
      display: 'about 8 min on foot', provenance: PROVENANCE.ESTIMATED,
      source: 'derived', method: 'straight-line x 1.35 at 4.8 km/h',
      at: pharmacy,
    })
    const f = reanchorFact(walk, property.lat, property.lng)
    // 400 m × 1.35 ÷ 4.8 km/h ≈ 7 min (was 8 from the cell centre)
    expect(f.value).toBe(7)
    expect(f.display).toBe('about 7 min on foot')
  })

  it('leaves facts without target coordinates untouched', () => {
    const count = fact({
      key: 'bus_stops_800m', label: 'Bus stops within 800 m', value: 4, unit: 'count',
      display: '4 stops', provenance: PROVENANCE.DERIVED, source: 'osm-poi', count: 4,
    })
    expect(reanchorFact(count, property.lat, property.lng)).toEqual(count)
  })

  it('never mutates the stored envelope — the cache stays cell-anchored', () => {
    const env = { key: 'lifestyle', facts: [storedFact()] }
    const modules = { lifestyle: env }
    const out = reanchorModules(modules, property.lat, property.lng)
    expect(env.facts[0].value).toBe(500)          // original untouched
    expect(out.lifestyle.facts[0].value).not.toBe(500)
  })

  it('respects displayStyle: metro facts keep plain distance phrasing', () => {
    const metro = fact({
      key: 'nearest_metro', label: 'Nearest metro station', value: 500, unit: 'm',
      display: 'Indiranagar — 500 m', provenance: PROVENANCE.DERIVED,
      source: 'osm-metro', at: pharmacy, place: 'Indiranagar', displayStyle: 'distance',
    })
    const f = reanchorFact(metro, property.lat, property.lng)
    expect(f.display).toMatch(/^Indiranagar — \d+ m$/)
    expect(f.display).not.toContain('walk')
  })
})
