// The India bounding box is defined once, in src/utils/geo.js.
//
// A lint rule shaped like a test, and the reason it exists is not today. Four
// numbers copied seven times across three files costs nothing while the
// platform is India-only — every copy says the same thing and none of them is
// wrong.
//
// It costs the day the platform operates anywhere else. Then "widen the bounds"
// stops being an edit and becomes a search, and the failure mode of missing one
// is the worst kind: the map accepts a listing in Dubai and the graph tools
// reject the same coordinates, or vice versa, with no error naming the
// disagreement. A grep is only as good as the person remembering to run it.
//
// Widening the box is deliberately NOT what this guards. Change the constant
// and every consumer follows — that is the point.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INDIA_BOUNDS, indiaLat, indiaLng } from '../src/utils/geo.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const CANONICAL = join(SRC, 'utils', 'geo.js')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return e.name.endsWith('.js') ? [p] : []
})

/**
 * The box written out by hand: a Zod bound or an object literal carrying the
 * four numbers. Narrow on purpose — `.min(6)` alone is a plausible rule for
 * something that is not a latitude, so each edge is matched against its own
 * literal rather than against any occurrence of the digits.
 */
const HAND_WRITTEN = [
  /\.min\(\s*6\s*\)\s*\.max\(\s*38\s*\)/,     // latitude, as Zod
  /\.min\(\s*68\s*\)\s*\.max\(\s*98\s*\)/,    // longitude, as Zod
  /minLat:\s*6\b[\s\S]{0,60}?maxLng:\s*98\b/, // the bounds object
]

describe('the India bounding box has one definition', () => {
  it('is not written out by hand anywhere else in src/', () => {
    const offenders = walk(SRC)
      .filter((f) => f !== CANONICAL)
      .filter((f) => HAND_WRITTEN.some((re) => re.test(readFileSync(f, 'utf8'))))
      .map((f) => f.replace(SRC, '').replace(/\\/g, '/'))

    expect(
      offenders,
      `import INDIA_BOUNDS / indiaLat / indiaLng from utils/geo.js instead:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('still holds the box it always did — this is a refactor, not a widening', () => {
    expect(INDIA_BOUNDS).toEqual({ minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 })
  })

  it('builds the same rule for a JSON body and a query string', async () => {
    // The two callers differ and the difference is real: a body carries a
    // number, a query string carries "12.99". Same bounds, different coercion.
    expect(indiaLat().safeParse(12.99).success).toBe(true)
    expect(indiaLat().safeParse(51.5).success).toBe(false)
    expect(indiaLng().safeParse(80.24).success).toBe(true)
    expect(indiaLng().safeParse(-0.12).success).toBe(false)

    const { z } = await import('zod')
    expect(indiaLat(z.coerce.number()).safeParse('12.99').success).toBe(true)
    expect(indiaLat(z.coerce.number()).safeParse('51.5').success).toBe(false)
  })
})
