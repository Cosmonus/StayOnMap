/**
 * Filters survive the round trip to the wire and back.
 *
 * This is the filter→pins flow tested at the layer where it actually breaks.
 * `toQueryParams` turns store state into the query string that goes to
 * `/properties/pins`, `/properties/count` and the URL; `parseFiltersFromSearch`
 * is its inverse, and is how a shared link restores a search.
 *
 * The failure mode here is silent in the worst way: a param the backend does
 * not recognise is simply ignored, so the map returns unfiltered results and
 * looks like it is working. That exact bug shipped once already — `GET
 * /properties` validated `swLat`/`swLng`/`neLat`/`neLng` and then never applied
 * them (see `.claude/backend.md`). Nothing about a wrong name is visible on
 * screen; you get pins, just the wrong ones.
 *
 * So the assertions are about the CONTRACT, not the mechanics:
 *   · a filter set by a user reaches the wire
 *   · it comes back as the same value, so a shared URL is the same search
 *   · defaults are omitted, so the query says only what the user chose
 */
import { describe, it, expect } from 'vitest'
import { toQueryParams, parseFiltersFromSearch, PARAM_DEFS } from './filters'
import { DEFAULT_FILTERS } from './filters'

const params = (obj) => new URLSearchParams(obj)

describe('filters → query params', () => {
  it('sends nothing at all when nothing is chosen', () => {
    // An untouched filter panel must produce an empty query. If a default ever
    // leaks in, every map request silently carries a constraint nobody set.
    expect(toQueryParams({ ...DEFAULT_FILTERS })).toEqual({})
  })

  it('omits a filter that has been returned to its default', () => {
    const q = toQueryParams({ ...DEFAULT_FILTERS, bhk: [], type: '' })
    expect(q).toEqual({})
  })

  it('joins multi-value filters as CSV, which is what the backend parses', () => {
    const q = toQueryParams({ ...DEFAULT_FILTERS, bhk: [2, 3] })
    expect(Object.values(q)).toContain('2,3')
  })

  it('sends booleans as the string "true", never as false', () => {
    const boolId = Object.keys(PARAM_DEFS).find((k) => PARAM_DEFS[k].kind === 'bool')
    if (!boolId) return
    expect(Object.values(toQueryParams({ ...DEFAULT_FILTERS, [boolId]: true }))).toContain('true')
    // `false` is the default — a filter switched off must vanish from the
    // query rather than travel as "false", which the backend would read as a
    // constraint that everything fails.
    expect(toQueryParams({ ...DEFAULT_FILTERS, [boolId]: false })).toEqual({})
  })
})

describe('query params → filters (a shared link is the same search)', () => {
  // The round trip is the real contract. Every filter is exercised generically,
  // so a filter added to the config is covered the day it is added rather than
  // whenever someone remembers to write a test for it.
  const sample = (def) => {
    switch (def.kind) {
      case 'csv': return ['a', 'b']
      case 'csvNum': return [2, 3]
      case 'num': return 42
      case 'bool': return true
      default: return 'sample'
    }
  }

  for (const [id, def] of Object.entries(PARAM_DEFS)) {
    it(`round-trips ${id}`, () => {
      const value = sample(def)
      const query = toQueryParams({ ...DEFAULT_FILTERS, [id]: value })

      // It must actually be on the wire — an omitted filter would round-trip
      // "successfully" as undefined and prove nothing.
      expect(Object.keys(query)).toContain(def.param ?? id)

      const back = parseFiltersFromSearch(params(query))
      expect(back[id]).toEqual(value)
    })
  }

  it('ignores an unknown param instead of crashing on a hand-edited URL', () => {
    expect(() => parseFiltersFromSearch(params({ nonsense: 'x' }))).not.toThrow()
    expect(parseFiltersFromSearch(params({ nonsense: 'x' }))).toEqual({})
  })

  it('drops a non-numeric value in a numeric filter rather than sending NaN', () => {
    // NaN reaching Prisma is a 500, and this endpoint is public — a
    // hand-edited or stale URL must not be able to cause one. That exact crash
    // was found in production on /properties/pins.
    const numId = Object.keys(PARAM_DEFS).find((k) => PARAM_DEFS[k].kind === 'num')
    if (!numId) return
    const back = parseFiltersFromSearch(params({ [PARAM_DEFS[numId].param ?? numId]: 'abc' }))
    expect(back[numId]).toBeUndefined()
  })
})
