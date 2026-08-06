/**
 * Every property type has a word, a colour and an icon — all eight of them.
 *
 * This is the mobile half of a bug reported from use on 2026-07-30: "we have
 * pills all over the locations, i dont know whats the property type". The map
 * was a field of prices, and the three types with no BHK — a plot, a shop, a
 * short stay — were a bare number in a coloured ring.
 *
 * The root cause is the thing this file guards: a per-type lookup with a
 * `?? fallback` HIDES a missing type instead of failing. `TYPE_ICON[type] ??
 * 'home'` silently drew a house for the two categories nobody had added, and
 * would do it again for a ninth. The tell is a fallback that is itself a real
 * value rather than null.
 *
 * CLAUDE.md's standing question — "does it work for all 6?" — is exactly this,
 * and the only way to make the answer countable is to enumerate the enum and
 * check every table against it. Adding a PropertyType without adding its three
 * entries now fails here rather than shipping as a wrong-looking pin.
 */
import { TYPE_COLOR, TYPE_ICON, TYPE_LABEL } from './propertyTypes'

// The PropertyType enum, verbatim from backend/prisma/schema.prisma. Restated
// rather than imported — mobile cannot import from the backend, and a hardcoded
// list that must be updated by hand is precisely the point: it fails loudly
// when the two drift.
const PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'VILLA',
  'PG',
  'INDEPENDENT_HOUSE',
  'COMMERCIAL',
  'LAND',
  'SHORT_STAY',
]

const TABLES = { TYPE_COLOR, TYPE_ICON, TYPE_LABEL }

describe('per-type presentation tables', () => {
  for (const [name, table] of Object.entries(TABLES)) {
    it(`${name} covers every PropertyType`, () => {
      const missing = PROPERTY_TYPES.filter((t) => !table[t])
      expect(missing).toEqual([])
    })

    it(`${name} has no entry for a type that does not exist`, () => {
      // The other direction: a stale key is a rename nobody finished, and it
      // reads as covered while the real type falls through to a fallback.
      const extra = Object.keys(table).filter((t) => !PROPERTY_TYPES.includes(t))
      expect(extra).toEqual([])
    })
  }

  // The three that carry no BHK are the ones the bug was actually about — on a
  // card or a pin they have no other distinguishing text, so the label is the
  // only thing telling a plot from a shop.
  it('gives the no-BHK types a distinct word each', () => {
    const words = ['LAND', 'COMMERCIAL', 'SHORT_STAY'].map((t) => TYPE_LABEL[t])
    expect(new Set(words).size).toBe(3)
    expect(words.every(Boolean)).toBe(true)
  })

  it('gives the no-BHK types a distinct icon each', () => {
    const icons = ['LAND', 'COMMERCIAL', 'SHORT_STAY'].map((t) => TYPE_ICON[t])
    expect(new Set(icons).size).toBe(3)
  })

  // HOUSE / VILLA / INDEPENDENT_HOUSE are one wizard category, so sharing a
  // colour and an icon is deliberate — but they keep their own words. Pinning
  // it stops someone "tidying" the duplication into a single entry and losing
  // the distinction on cards.
  it('shares a colour and icon across the three house variants, but not the word', () => {
    const houses = ['HOUSE', 'VILLA', 'INDEPENDENT_HOUSE']
    expect(new Set(houses.map((t) => TYPE_COLOR[t])).size).toBe(1)
    expect(new Set(houses.map((t) => TYPE_ICON[t])).size).toBe(1)
    expect(new Set(houses.map((t) => TYPE_LABEL[t])).size).toBe(houses.length)
  })
})
