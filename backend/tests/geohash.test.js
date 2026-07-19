import { describe, it, expect } from 'vitest'
import { encode, decode, bounds, neighbours, haversineMeters, DEFAULT_PRECISION } from '../src/lib/geohash.js'

// Known-good fixtures, cross-checked against the reference geohash algorithm.
// These are the guard against a subtle bit-order regression, which would
// silently re-key every cell in the SpatialContext table.
describe('geohash encode', () => {
  it('matches known reference values', () => {
    expect(encode(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
    expect(encode(0, 0, 5)).toBe('s0000')
    expect(encode(-90, -180, 5)).toBe('00000')
    expect(encode(90, 180, 5)).toBe('zzzzz')
  })

  it('defaults to precision 7', () => {
    expect(encode(12.9716, 77.5946)).toHaveLength(DEFAULT_PRECISION)
  })

  it('encodes the 9 supported cities to distinct cells', () => {
    const cities = [
      [28.6139, 77.2090], [19.0760, 72.8777], [22.5726, 88.3639],
      [13.0827, 80.2707], [12.9716, 77.5946], [17.3850, 78.4867],
      [23.0225, 72.5714], [18.5204, 73.8567], [21.1702, 72.8311],
    ]
    const hashes = cities.map(([lat, lng]) => encode(lat, lng))
    expect(new Set(hashes).size).toBe(cities.length)
  })

  it('rejects non-finite input rather than producing a garbage cell key', () => {
    expect(() => encode(NaN, 77)).toThrow(TypeError)
    expect(() => encode(12.97, undefined)).toThrow(TypeError)
  })
})

describe('geohash decode / bounds', () => {
  it('round-trips a coordinate to within the cell size', () => {
    const lat = 12.9716, lng = 77.5946
    const { lat: dLat, lng: dLng } = decode(encode(lat, lng))
    // Precision 7 cells are ~153m x ~153m, so the centroid is within ~110m.
    expect(haversineMeters(lat, lng, dLat, dLng)).toBeLessThan(120)
  })

  it('produces a bounding box that actually contains the source point', () => {
    const lat = 13.0827, lng = 80.2707
    const b = bounds(encode(lat, lng))
    expect(lat).toBeGreaterThanOrEqual(b.latMin)
    expect(lat).toBeLessThanOrEqual(b.latMax)
    expect(lng).toBeGreaterThanOrEqual(b.lngMin)
    expect(lng).toBeLessThanOrEqual(b.lngMax)
  })

  it('gives a precision-7 cell of roughly 153m x 153m', () => {
    const b = bounds(encode(12.9716, 77.5946))
    const height = haversineMeters(b.latMin, b.lngMin, b.latMax, b.lngMin)
    const width = haversineMeters(b.latMin, b.lngMin, b.latMin, b.lngMax)
    expect(height).toBeGreaterThan(120)
    expect(height).toBeLessThan(180)
    expect(width).toBeGreaterThan(120)
    expect(width).toBeLessThan(180)
  })

  it('rejects invalid characters (a, i, l, o are not in the alphabet)', () => {
    expect(() => bounds('tdri123')).toThrow(TypeError)
    expect(() => bounds('')).toThrow(TypeError)
  })
})

describe('geohash prefix behaviour', () => {
  // This is what lets a coarse query be `WHERE geohash LIKE 'tdr1%'` on a
  // plain btree index instead of a spatial one.
  it('nests: a shorter hash is a prefix of the longer hash of the same point', () => {
    const full = encode(12.9716, 77.5946, 9)
    for (let p = 1; p <= 9; p++) {
      expect(full.startsWith(encode(12.9716, 77.5946, p))).toBe(true)
    }
  })
})

describe('geohash neighbours', () => {
  it('returns the cell plus its 8 surrounding cells', () => {
    const hash = encode(12.9716, 77.5946)
    const ring = neighbours(hash)
    expect(ring).toHaveLength(9)
    expect(ring).toContain(hash)
    expect(new Set(ring).size).toBe(9)
  })

  it('returns cells all at the same precision', () => {
    const ring = neighbours(encode(19.0760, 72.8777))
    for (const h of ring) expect(h).toHaveLength(DEFAULT_PRECISION)
  })

  it('surrounds the centre — every neighbour is adjacent, none is far', () => {
    const hash = encode(13.0827, 80.2707)
    const { lat, lng } = decode(hash)
    for (const n of neighbours(hash)) {
      const c = decode(n)
      // Diagonal neighbour centroid is at most ~1.5 cell diagonals away.
      expect(haversineMeters(lat, lng, c.lat, c.lng)).toBeLessThan(400)
    }
  })
})

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(12.97, 77.59, 12.97, 77.59)).toBe(0)
  })

  it('matches a known city-to-city distance', () => {
    // Bengaluru → Chennai is ~290km great-circle.
    const d = haversineMeters(12.9716, 77.5946, 13.0827, 80.2707) / 1000
    expect(d).toBeGreaterThan(280)
    expect(d).toBeLessThan(300)
  })
})
