// Entity resolution: the false-merge is the catastrophic failure, so every
// case here leans on the rule's conservative side.
//
// Thresholds became CATEGORY-AWARE on 2026-08-11 (poiPolicy.js's FOOTPRINTS),
// so every case now names the category it is about. The flat 50/150 m pair this
// replaced was one number doing two incompatible jobs — see the per-category
// block at the bottom, which is the whole reason it changed.
import { describe, it, expect } from 'vitest'
import { normalizeName, nameSimilarity, samePlace, matchPlace } from '../src/features/spatial/places.js'

const at = (lat, lng, name) => ({ lat, lng, name })
const BASE = { lat: 12.9716, lng: 77.5946 }
// Degrees of latitude per metre, so a case can say what it means.
const M = 1 / 111_320

describe('nameSimilarity', () => {
  it('a subset name is the same business spelled longer', () => {
    expect(nameSimilarity('Apollo Pharmacy', 'Apollo Pharmacy Koramangala Branch')).toBe(1)
  })
  it('different businesses share nothing', () => {
    expect(nameSimilarity('Apollo Pharmacy', 'MedPlus')).toBe(0)
  })
  it('punctuation and case are not differences', () => {
    expect(normalizeName("St. Mary's School")).toBe('st mary s school')
    expect(nameSimilarity('ST. MARYS SCHOOL', 'st marys school')).toBe(1)
  })
})

describe('samePlace', () => {
  it('inside the unnamed radius: merges when a record is unnamed (node/way doubles) or names agree', () => {
    const a = at(BASE.lat, BASE.lng, 'Fortis')
    const b = at(BASE.lat + 33 * M, BASE.lng, null)
    expect(samePlace(a, b, 'hospital')).toBe(true)
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Fortis Hospital'),
      at(BASE.lat + 33 * M, BASE.lng, 'Fortis'),
      'hospital'
    )).toBe(true)
  })

  it('inside the unnamed radius: two NAMED, disagreeing records stay separate — neighbours are not doubles', () => {
    // Two different restaurants 22 m apart are routine on an Indian street;
    // a false merge destroys a real place.
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Meghana Foods'),
      at(BASE.lat + 22 * M, BASE.lng, 'Empire Hotel'),
      'restaurant'
    )).toBe(false)
  })

  it('out to the named radius: only with name agreement — packed streets must not merge competitors', () => {
    const seventyEight = at(BASE.lat + 78 * M, BASE.lng, 'Apollo Pharmacy')
    expect(samePlace(at(BASE.lat, BASE.lng, 'Apollo Pharmacy Branch'), seventyEight, 'pharmacy')).toBe(true)
    expect(samePlace(at(BASE.lat, BASE.lng, 'MedPlus'), seventyEight, 'pharmacy')).toBe(false)
  })

  it('beyond the named radius: never the same place, even with identical names (chains exist)', () => {
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Apollo Pharmacy'),
      at(BASE.lat + 223 * M, BASE.lng, 'Apollo Pharmacy'),
      'pharmacy'
    )).toBe(false)
  })

  it('reads the category off the records when none is passed', () => {
    const a = { ...at(BASE.lat, BASE.lng, 'Fortis'), category: 'hospital' }
    const b = { ...at(BASE.lat + 100 * M, BASE.lng, null), category: 'hospital' }
    expect(samePlace(a, b)).toBe(true)
  })

  it('falls back to the TIGHTEST tier when the category is unknown', () => {
    // Conservative direction: fewest merges. 100 m with an unnamed partner
    // would merge under hospital's 120 m and must not under the default.
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Fortis'),
      at(BASE.lat + 100 * M, BASE.lng, null)
    )).toBe(false)
  })
})

// ── Why the thresholds stopped being flat ───────────────────────────────────
// These four cases are the argument. Under a single 50/150 m rule the first two
// merged when they must not and the last two split when they must not.

describe('category-aware footprints', () => {
  const unnamedPartner = (metres) => at(BASE.lat + metres * M, BASE.lng, null)

  it('two unnamed cafes 25 m apart are two cafes', () => {
    // A single shopfront is a point. The old flat 30 m unnamed radius merged
    // these, and on an Indian high street that is a real business erased.
    expect(samePlace(at(BASE.lat, BASE.lng, 'Third Wave'), unnamedPartner(25), 'cafe')).toBe(false)
  })

  it('an ATM lobby holds more than one ATM', () => {
    expect(samePlace(at(BASE.lat, BASE.lng, 'ICICI ATM'), unnamedPartner(25), 'atm')).toBe(false)
  })

  it('a hospital campus mapped as separate blocks is one hospital', () => {
    // The old 150 m named ceiling split Manipal's blocks into three hospitals,
    // which then all counted separately in "hospitals within 2 km".
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Manipal Hospital'),
      at(BASE.lat + 300 * M, BASE.lng, 'Manipal Hospital Block B'),
      'hospital'
    )).toBe(true)
  })

  it('an airport terminal and its perimeter are one airport', () => {
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Kempegowda International Airport'),
      at(BASE.lat + 800 * M, BASE.lng, 'Kempegowda International Airport Terminal 2'),
      'airport'
    )).toBe(true)
  })

  it('still refuses two BRANCHES of one chain, whatever the footprint', () => {
    // The case the ceiling exists for. Even at airport's 1 km radius, two
    // Apollo Pharmacies 4 km apart are two pharmacies.
    expect(samePlace(
      at(BASE.lat, BASE.lng, 'Apollo Pharmacy'),
      at(BASE.lat + 4000 * M, BASE.lng, 'Apollo Pharmacy'),
      'airport'
    )).toBe(false)
  })
})

describe('matchPlace', () => {
  it('returns the first matching candidate, null when nothing matches', () => {
    const record = at(BASE.lat, BASE.lng, 'Apollo Pharmacy')
    const far = at(BASE.lat + 1113 * M, BASE.lng, 'Apollo Pharmacy')
    const near = at(BASE.lat + 22 * M, BASE.lng, 'Apollo')
    expect(matchPlace(record, [far, near], 'pharmacy')).toBe(near)
    expect(matchPlace(record, [far], 'pharmacy')).toBeNull()
    expect(matchPlace(record, [], 'pharmacy')).toBeNull()
  })
})
