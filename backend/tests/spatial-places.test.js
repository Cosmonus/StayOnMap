// Entity resolution: the false-merge is the catastrophic failure, so every
// case here leans on the rule's conservative side.
import { describe, it, expect } from 'vitest'
import { normalizeName, nameSimilarity, samePlace, matchPlace } from '../src/features/spatial/places.js'

const at = (lat, lng, name) => ({ lat, lng, name })
// ~0.00045 degrees latitude ≈ 50 m
const BASE = { lat: 12.9716, lng: 77.5946 }

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
  it('within 50 m: merges when a record is unnamed (node/way doubles) or names agree', () => {
    expect(samePlace(at(BASE.lat, BASE.lng, 'Fortis'), at(BASE.lat + 0.0003, BASE.lng, null))).toBe(true)
    expect(samePlace(at(BASE.lat, BASE.lng, 'Fortis Hospital'), at(BASE.lat + 0.0003, BASE.lng, 'Fortis'))).toBe(true)
  })

  it('within 50 m: two NAMED, disagreeing records stay separate — neighbours are not doubles', () => {
    // Two different restaurants 30 m apart are routine on an Indian street;
    // a false merge destroys a real place.
    expect(samePlace(at(BASE.lat, BASE.lng, 'Meghana Foods'), at(BASE.lat + 0.0002, BASE.lng, 'Empire Hotel'))).toBe(false)
  })

  it('50-150 m: only with name agreement — packed streets must not merge competitors', () => {
    const hundredMetersAway = at(BASE.lat + 0.0009, BASE.lng, 'Apollo Pharmacy')
    expect(samePlace(at(BASE.lat, BASE.lng, 'Apollo Pharmacy Branch'), hundredMetersAway)).toBe(true)
    expect(samePlace(at(BASE.lat, BASE.lng, 'MedPlus'), hundredMetersAway)).toBe(false)
  })

  it('beyond 150 m: never the same place, even with identical names (chains exist)', () => {
    expect(samePlace(at(BASE.lat, BASE.lng, 'Apollo Pharmacy'), at(BASE.lat + 0.002, BASE.lng, 'Apollo Pharmacy'))).toBe(false)
  })
})

describe('matchPlace', () => {
  it('returns the first matching candidate, null when nothing matches', () => {
    const record = at(BASE.lat, BASE.lng, 'Apollo Pharmacy')
    const far = at(BASE.lat + 0.01, BASE.lng, 'Apollo Pharmacy')
    const near = at(BASE.lat + 0.0002, BASE.lng, 'Apollo')
    expect(matchPlace(record, [far, near])).toBe(near)
    expect(matchPlace(record, [far])).toBeNull()
    expect(matchPlace(record, [])).toBeNull()
  })
})
