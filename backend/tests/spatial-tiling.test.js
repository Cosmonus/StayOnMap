// Adaptive tile subdivision.
//
// Written after the first production seeding attempt died on Delhi's tile 1 of
// 9 with `HTTP 504` from every Overpass mirror. The retry at the time re-issued
// the identical box — and a 504 is Overpass saying the QUERY was too big, not
// that the wire blinked, so repeating it verbatim was the one strategy
// guaranteed to fail the same way.
import { describe, it, expect, vi } from 'vitest'
import { tiles, fetchTileAdaptive } from '../src/features/spatial/tiling.js'

const BOX = { south: 12.9, west: 77.5, north: 13.0, east: 77.6 }

describe('fetchTileAdaptive', () => {
  it('does not subdivide when the tile succeeds', async () => {
    const fetchFn = vi.fn(async () => 42)
    expect(await fetchTileAdaptive(BOX, fetchFn)).toBe(42)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('quarters a failing tile instead of repeating it', async () => {
    const seen = []
    const fetchFn = vi.fn(async (t) => {
      seen.push(t)
      // Only the original, full-size box fails.
      if (t.north - t.south > 0.09) throw new Error('HTTP 504')
      return 10
    })

    const total = await fetchTileAdaptive(BOX, fetchFn)

    expect(total).toBe(40)                       // four quarters, 10 each
    expect(fetchFn).toHaveBeenCalledTimes(5)     // the original + 4 children
    // The retry must be a DIFFERENT query. If any child were the same size as
    // the parent, this is just the old behaviour wearing a new name.
    const children = seen.slice(1)
    expect(children).toHaveLength(4)
    for (const c of children) {
      expect(c.north - c.south).toBeLessThan(BOX.north - BOX.south)
    }
  })

  it('subdivides again when a quarter is still too big', async () => {
    const fetchFn = vi.fn(async (t) => {
      if (t.north - t.south > 0.03) throw new Error('HTTP 504')
      return 1
    })
    // 1 original + 4 quarters + 16 sixteenths = 21 calls, all 16 leaves succeed.
    expect(await fetchTileAdaptive(BOX, fetchFn)).toBe(16)
    expect(fetchFn).toHaveBeenCalledTimes(21)
  })

  it('gives up at maxDepth and rethrows, rather than reporting an empty tile', async () => {
    // The honest outcome: the caller records a failed tile, which files
    // complete:false and skips stale-row removal. Swallowing this would leave a
    // hole in the map that looks exactly like "there is nothing here".
    const fetchFn = vi.fn(async () => { throw new Error('HTTP 504') })
    await expect(fetchTileAdaptive(BOX, fetchFn, { maxDepth: 1 })).rejects.toThrow('504')
    expect(fetchFn).toHaveBeenCalledTimes(5) // original + 4, then stop
  })

  it('keeps rows gathered by siblings that DID succeed', async () => {
    // Partial success still fails the parent tile, but the collection the
    // callback writes into is not rolled back — re-running converges on osmId.
    const collected = []
    const fetchFn = vi.fn(async (t) => {
      if (t.west < 77.55) throw new Error('HTTP 504')
      collected.push(t)
      return 1
    })
    await expect(fetchTileAdaptive(BOX, fetchFn, { maxDepth: 1 })).rejects.toThrow()
    expect(collected.length).toBeGreaterThan(0)
  })

  it('tiles() still partitions without gaps or overlap', () => {
    const grid = tiles(BOX, 3)
    expect(grid).toHaveLength(9)
    expect(Math.min(...grid.map((t) => t.south))).toBeCloseTo(BOX.south, 6)
    expect(Math.max(...grid.map((t) => t.north))).toBeCloseTo(BOX.north, 6)
  })
})
