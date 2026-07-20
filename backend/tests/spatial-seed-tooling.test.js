// The two helpers the OSM seeders share.
//
// Both were inline copies in scripts/ until they were extracted, and both have
// already shipped a bug that no test could have caught while they lived there:
// `--confirm` parsed as a city named "confirm", and tile geometry that nothing
// ever checked for gaps. Seeder bugs are the expensive kind — they fail
// silently at 3am and surface weeks later as an area that reports "nothing
// nearby" while being perfectly well mapped.
import { describe, it, expect } from 'vitest'
import { parseSeedArgs, flagValue } from '../src/features/spatial/seedArgs.js'
import { bboxFor, tiles } from '../src/features/spatial/tiling.js'

describe('parseSeedArgs', () => {
  it('defaults to a dry run over every city', () => {
    // The safe default matters more than the parsing: an unrecognised argv must
    // never be read as "yes, write to prod".
    expect(parseSeedArgs([])).toEqual({ confirm: false, city: null, allowUnseeded: false })
    expect(parseSeedArgs()).toEqual({ confirm: false, city: null, allowUnseeded: false })
  })

  it('does not read a bare --confirm as a city named "confirm"', () => {
    // The shipped bug, verbatim: indexOf('--city') returns -1 when the flag is
    // absent, and args[-1 + 1] is args[0]. A dry run that silently seeded
    // nothing, or a confirmed run that seeded one imaginary city.
    expect(parseSeedArgs(['--confirm'])).toEqual({
      confirm: true, city: null, allowUnseeded: false,
    })
  })

  it('reads a city in either argument order', () => {
    expect(parseSeedArgs(['--city', 'Chennai', '--confirm'])).toEqual({
      confirm: true, city: 'Chennai', allowUnseeded: false,
    })
    expect(parseSeedArgs(['--confirm', '--city', 'Chennai'])).toEqual({
      confirm: true, city: 'Chennai', allowUnseeded: false,
    })
  })

  it('treats a missing city value as no city, never as the next flag', () => {
    // `--city --confirm` is an operator typo. Resolving it to a city literally
    // named "--confirm" would match nothing in CITY_CENTERS and seed zero rows
    // while reporting success.
    expect(parseSeedArgs(['--city', '--confirm']).city).toBeNull()
    expect(parseSeedArgs(['--city']).city).toBeNull()
  })

  it('carries --allow-unseeded, which is a different scary thing', () => {
    // backfill-spatial-context.mjs refuses to run against an empty PoiIndex
    // without it, because backfilling then persists Google-fallback envelopes
    // for their full TTLs.
    expect(parseSeedArgs(['--allow-unseeded']).allowUnseeded).toBe(true)
    expect(parseSeedArgs(['--confirm']).allowUnseeded).toBe(false)
  })

  it('flagValue is absent/last/followed-by-flag safe', () => {
    expect(flagValue(['--a', 'x'], '--a')).toBe('x')
    expect(flagValue(['--a', 'x'], '--b')).toBeNull()
    expect(flagValue(['--a'], '--a')).toBeNull()
    expect(flagValue(['--a', '--b'], '--a')).toBeNull()
  })
})

describe('bboxFor', () => {
  const CHENNAI = { lat: 13.0827, lng: 80.2707 }
  const DELHI = { lat: 28.6139, lng: 77.209 }

  it('centres the box on the point', () => {
    const b = bboxFor({ ...CHENNAI, radiusKm: 25 })
    expect((b.north + b.south) / 2).toBeCloseTo(CHENNAI.lat, 10)
    expect((b.east + b.west) / 2).toBeCloseTo(CHENNAI.lng, 10)
  })

  it('spans roughly 2×radius north to south', () => {
    const b = bboxFor({ ...CHENNAI, radiusKm: 25 })
    expect((b.north - b.south) * 111.32).toBeCloseTo(50, 1)
  })

  it('cos-corrects longitude, so the box is not too wide up north', () => {
    // Uncorrected, Delhi's box would be ~14% too wide east-west — it would
    // fetch a band of POIs outside the intended radius and, worse, make the
    // tile grid non-square in a way nothing downstream accounts for.
    const width = (bb) => bb.east - bb.west
    expect(width(bboxFor({ ...DELHI, radiusKm: 25 })))
      .toBeGreaterThan(width(bboxFor({ ...CHENNAI, radiusKm: 25 })))

    // The correction is 1/cos(lat) exactly, not an approximation of it.
    const dLng = width(bboxFor({ ...DELHI, radiusKm: 25 })) / 2
    expect(dLng).toBeCloseTo(25 / (111.32 * Math.cos((DELHI.lat * Math.PI) / 180)), 9)
  })
})

describe('tiles', () => {
  const BBOX = bboxFor({ lat: 13.0827, lng: 80.2707, radiusKm: 30 })

  it('returns exactly n × n tiles', () => {
    expect(tiles(BBOX, 4)).toHaveLength(16)
    expect(tiles(BBOX, 1)).toHaveLength(1)
  })

  it('covers the parent box exactly — no gap at any shared edge', () => {
    // This is the whole reason the module was extracted. A sub-degree gap
    // between two tiles is invisible at seed time; it surfaces later as a
    // street that reports "nothing nearby" while being perfectly well mapped.
    const grid = tiles(BBOX, 4)

    const lats = [...new Set(grid.flatMap((t) => [t.south, t.north]))].sort((a, b) => a - b)
    const lngs = [...new Set(grid.flatMap((t) => [t.west, t.east]))].sort((a, b) => a - b)

    // 4 rows sharing edges produce 5 distinct boundaries, not 8 — which is only
    // true if each tile's north is byte-identical to its neighbour's south.
    expect(lats).toHaveLength(5)
    expect(lngs).toHaveLength(5)

    expect(lats[0]).toBe(BBOX.south)
    expect(lats[4]).toBe(BBOX.north)
    expect(lngs[0]).toBe(BBOX.west)
    expect(lngs[4]).toBe(BBOX.east)
  })

  it('produces tiles of equal size that sum to the parent area', () => {
    const grid = tiles(BBOX, 4)
    const area = (t) => (t.north - t.south) * (t.east - t.west)
    const parent = (BBOX.north - BBOX.south) * (BBOX.east - BBOX.west)

    for (const t of grid) expect(area(t)).toBeCloseTo(parent / 16, 12)
    expect(grid.reduce((s, t) => s + area(t), 0)).toBeCloseTo(parent, 12)
  })

  it('never emits an inverted or zero-height tile', () => {
    // An inverted bbox is accepted by Overpass and returns nothing, which reads
    // downstream as a genuinely empty area rather than a malformed query.
    for (const t of tiles(BBOX, 4)) {
      expect(t.north).toBeGreaterThan(t.south)
      expect(t.east).toBeGreaterThan(t.west)
    }
  })

  it('n = 1 round-trips the box unchanged', () => {
    expect(tiles(BBOX, 1)[0]).toEqual({
      south: BBOX.south, north: BBOX.north, west: BBOX.west, east: BBOX.east,
    })
  })
})
