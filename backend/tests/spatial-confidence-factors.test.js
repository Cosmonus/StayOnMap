// Confidence v2 — factors beyond input availability.
//
// The load-bearing rule is that a factor may only ever REDUCE. Input
// availability is the one signal that has actually been measured; everything
// else (coverage, freshness, spatial precision) is a reason to trust the number
// less, never more. Without that rule enforced in code, "confidence v2" is a
// row of knobs someone turns until the cards look confident — the exact failure
// this layer was built to prevent.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { computeConfidence, buildEnvelope, bandFor } from '../src/features/spatial/envelope.js'
import { coverageFactor, freshnessFactor } from '../src/features/spatial/dataQuality.js'
import lifestyle from '../src/features/spatial/modules/lifestyle.module.js'

const INPUTS = [
  { key: 'a', weight: 2 },
  { key: 'b', weight: 1 },
  { key: 'c', weight: 1 },
]

describe('computeConfidence — factors may only reduce', () => {
  it('rejects a multiplier above 1', () => {
    // The whole mechanism in one assertion. A factor that raises confidence
    // would let a module claim certainty its inputs never supported.
    expect(() =>
      computeConfidence(INPUTS, ['a', 'b', 'c'], 1, [
        { key: 'boost', reason: 'more sources', multiplier: 1.2 },
      ])
    ).toThrow(/above 1 would raise confidence/i)
  })

  it('rejects a factor with no explanation', () => {
    expect(() =>
      computeConfidence(INPUTS, ['a'], 1, [{ key: 'mystery', multiplier: 0.5 }])
    ).toThrow(/reason is required/i)
  })

  it('rejects a factor that neither multiplies nor caps', () => {
    expect(() =>
      computeConfidence(INPUTS, ['a'], 1, [{ key: 'noop', reason: 'because' }])
    ).toThrow(/multiplier or a cap/i)
  })

  it('leaves the base untouched when no factors are given', () => {
    // Backwards compatibility: every existing module passes no factors and must
    // score exactly what it scored before.
    const c = computeConfidence(INPUTS, ['a', 'b'], 1)
    expect(c.value).toBe(0.75)
    expect(c.base).toBe(0.75)
    expect(c.factors).toEqual([])
  })
})

describe('computeConfidence — the breakdown', () => {
  it('reports base and final separately, so "why" survives', () => {
    const c = computeConfidence(INPUTS, ['a', 'b', 'c'], 1, [
      { key: 'coverage', reason: 'fetch did not complete', cap: 0.74 },
    ])
    expect(c.base).toBe(1)
    expect(c.value).toBe(0.74)
    expect(c.band).toBe('MODERATE')
  })

  it('reports factors that changed nothing, not just the ones that bit', () => {
    // "Coverage was complete, so this did not reduce anything" is information.
    // Only listing the penalties makes a clean run look unexamined.
    const c = computeConfidence(INPUTS, ['a'], 1, [
      { key: 'coverage', reason: 'complete', cap: 0.9 },
    ])
    expect(c.factors).toHaveLength(1)
    expect(c.factors[0].applied).toBe(false)
    expect(c.value).toBe(c.base)
  })

  it('names the biting factors in the basis string', () => {
    const c = computeConfidence(INPUTS, ['a', 'b', 'c'], 1, [
      { key: 'coverage', reason: 'incomplete', cap: 0.74 },
      { key: 'freshness', reason: 'stale', multiplier: 0.9 },
    ])
    expect(c.basis).toMatch(/coverage/)
    expect(c.basis).toMatch(/freshness/)
  })

  it('composes multiple factors in order', () => {
    const c = computeConfidence(INPUTS, ['a', 'b', 'c'], 1, [
      { key: 'freshness', reason: 'stale', multiplier: 0.5 },
      { key: 'coverage', reason: 'incomplete', cap: 0.74 },
    ])
    // 1.0 → ×0.5 = 0.5 → cap 0.74 does not bite (0.5 already below it)
    expect(c.value).toBe(0.5)
    expect(c.factors[1].applied).toBe(false)
  })

  it('rounding never ratchets a reduction back up', () => {
    // The regression a "tidier" per-step rounding introduced. Math.round is
    // half-up, so rounding the running value made `round(0.495) = 0.50` — with
    // base 0.50 and two ×0.99 factors, every step rounded back to 0.50, BOTH
    // reductions reported `applied: false`, the basis line stopped mentioning
    // them, and confidence ended higher than the factors said. A rule enforced
    // by a throw elsewhere in this file, quietly undone by a rounding mode.
    const c = computeConfidence([{ key: 'a', weight: 1 }], ['a'], 0.5, [
      { key: 'x', reason: 'r', multiplier: 0.99 },
      { key: 'y', reason: 'r', multiplier: 0.99 },
    ])

    expect(c.base).toBe(0.5)
    expect(c.value).toBeLessThan(c.base)
    expect(c.factors.every((f) => f.applied)).toBe(true)
    expect(c.basis).toMatch(/x/)
    expect(c.basis).toMatch(/y/)
  })

  it('reports a continuous chain — each factor starts where the last ended', () => {
    const c = computeConfidence([{ key: 'a', weight: 1 }], ['a'], 1, [
      { key: 'x', reason: 'r', multiplier: 0.9 },
      { key: 'y', reason: 'r', multiplier: 0.9 },
      { key: 'z', reason: 'r', multiplier: 0.9 },
    ])
    for (let i = 1; i < c.factors.length; i++) {
      expect(c.factors[i].from).toBe(c.factors[i - 1].to)
    }
    expect(c.value).toBe(c.factors.at(-1).to)
  })

  it('never pushes a module above its own ceiling', () => {
    // maxConfidence is a hard ceiling for inherently inferential modules; no
    // combination of factors may exceed it, and factors only reduce anyway.
    const c = computeConfidence(INPUTS, ['a', 'b', 'c'], 0.45, [
      { key: 'coverage', reason: 'complete', cap: 1 },
    ])
    expect(c.value).toBeLessThanOrEqual(0.45)
  })

  it('cannot be driven below zero or above one', () => {
    const low = computeConfidence(INPUTS, ['a'], 1, [
      { key: 'x', reason: 'r', multiplier: 0.01 },
      { key: 'y', reason: 'r', cap: 0 },
    ])
    expect(low.value).toBeGreaterThanOrEqual(0)
    expect(bandFor(low.value)).toBe('MINIMAL')
  })
})

describe('buildEnvelope passes factors through', () => {
  const MODULE = { key: 'test', version: 1, maxConfidence: 1, inputs: INPUTS, ttlHours: 24 }

  it('applies confidenceFactors from the module result', () => {
    const e = buildEnvelope(MODULE, {
      facts: [{ key: 'f', label: 'F', display: 'x' }],
      inputsPresent: ['a', 'b', 'c'],
      confidenceFactors: [{ key: 'coverage', reason: 'incomplete', cap: 0.74 }],
    })
    expect(e.confidence.value).toBe(0.74)
    expect(e.confidence.base).toBe(1)
  })

  it('is unchanged for a module that declares none', () => {
    const e = buildEnvelope(MODULE, {
      facts: [{ key: 'f', label: 'F', display: 'x' }],
      inputsPresent: ['a', 'b', 'c'],
    })
    expect(e.confidence.value).toBe(1)
    expect(e.confidence.factors).toEqual([])
  })
})

describe('freshnessFactor', () => {
  const NOW = new Date('2026-07-20T00:00:00Z')
  const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

  it('says nothing while the data is within its intended refresh cycle', () => {
    // §4.4 sets POI refresh at quarterly. On schedule is not a defect.
    expect(freshnessFactor(daysAgo(10), NOW)).toBeNull()
    expect(freshnessFactor(daysAgo(89), NOW)).toBeNull()
  })

  it('reduces gently once a refresh has been missed', () => {
    const f = freshnessFactor(daysAgo(200), NOW)
    expect(f.multiplier).toBe(0.9)
    expect(f.reason).toMatch(/months old/i)
  })

  it('reduces harder past a year, but floors rather than collapsing', () => {
    // Old OSM data is still mostly right — hospitals, schools and parks do not
    // move. The penalty belongs on the shop-level facts that genuinely rot.
    const f = freshnessFactor(daysAgo(900), NOW)
    expect(f.multiplier).toBe(0.75)
    expect(f.multiplier).toBeGreaterThan(0)
    expect(f.reason).toMatch(/year/i)
  })

  it('is a multiplier, not a cap — unlike coverage', () => {
    // We know the magnitude here (age is exact), so a graded reduction is a
    // claim we can support. `complete: false` never says by how much, which is
    // why that one caps instead.
    expect(freshnessFactor(daysAgo(200), NOW).cap).toBeUndefined()
  })

  it('says nothing when the fetch date is unknown or unparseable', () => {
    expect(freshnessFactor(null, NOW)).toBeNull()
    expect(freshnessFactor(undefined, NOW)).toBeNull()
    expect(freshnessFactor('not-a-date', NOW)).toBeNull()
  })

  it('treats a future timestamp as current, not as negative age', () => {
    // A clock skew is our problem, not fresher-than-fresh data.
    expect(freshnessFactor(daysAgo(-30), NOW)).toBeNull()
  })

  it('accepts an ISO string, which is what poiFreshness returns', () => {
    expect(freshnessFactor('2025-01-01', NOW).multiplier).toBe(0.75)
  })
})

describe('end to end — an incomplete fetch reaches the card', () => {
  // The point of the whole wire. Everything above tests a part; this tests that
  // the parts are actually connected, which is the failure mode that let
  // DataQualityReport.complete sit populated and unread since it shipped.
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { category: 'pharmacy',    name: 'Apollo', lat: 12.9790, lng: 77.6408 },
      { category: 'supermarket', name: 'More',   lat: 12.9788, lng: 77.6410 },
    ])
    prismaMock.poiIndex.aggregate.mockResolvedValue({ _max: { fetchedAt: new Date() } })
  })

  const CELL = { lat: 12.9784, lng: 77.6408, city: 'Bengaluru' }

  it('caps a lifestyle card when the POI fetch for that city fell short', async () => {
    prismaMock.dataQualityReport.findFirst.mockResolvedValue({
      dataset: 'poi_index', scope: 'Bengaluru', complete: false,
    })
    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))

    expect(e.confidence.value).toBeLessThanOrEqual(0.74)
    expect(e.confidence.value).toBeLessThan(e.confidence.base)
    expect(e.confidence.factors.some((f) => f.key === 'coverage' && f.applied)).toBe(true)
    expect(e.confidence.basis).toMatch(/coverage/)
  })

  it('composes coverage and freshness on one card', async () => {
    // The two answer different questions — "did the fetch finish" and "how long
    // ago was it" — and a card can be hit by both. Each must appear as its own
    // line: collapsing them into one penalty would leave the user unable to
    // tell a gap we can fix by re-running from one we fix by re-fetching.
    prismaMock.dataQualityReport.findFirst.mockResolvedValue({
      dataset: 'poi_index', scope: 'Bengaluru', complete: false,
    })
    prismaMock.poiIndex.aggregate.mockResolvedValue({
      _max: { fetchedAt: new Date(Date.now() - 800 * 24 * 60 * 60 * 1000) },
    })

    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))
    const bit = e.confidence.factors.filter((f) => f.applied).map((f) => f.key)

    expect(bit).toContain('coverage')
    expect(bit).toContain('freshness')

    // Cap first, then scale — reporting the scale first would describe the
    // score as having been reduced from a number it never held. Asserted as an
    // ordering and a bound rather than a literal: 0.74 × 0.75 is 0.5549999… in
    // floating point, and pinning the rounded output would be testing IEEE 754
    // rather than the policy.
    const order = e.confidence.factors.map((f) => f.key)
    expect(order.indexOf('coverage')).toBeLessThan(order.indexOf('freshness'))
    expect(e.confidence.value).toBeLessThanOrEqual(0.74 * 0.75)
    expect(e.confidence.value).toBeLessThan(e.confidence.base)
  })

  it('leaves the same card alone when that fetch completed', async () => {
    prismaMock.dataQualityReport.findFirst.mockResolvedValue({
      dataset: 'poi_index', scope: 'Bengaluru', complete: true,
    })
    const e = buildEnvelope(lifestyle, await lifestyle.compute(CELL))

    expect(e.confidence.value).toBe(e.confidence.base)
    expect(e.confidence.factors).toEqual([])
  })
})

describe('coverageFactor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('caps confidence when the last run knew it was incomplete', async () => {
    prismaMock.dataQualityReport.findFirst.mockResolvedValue({
      dataset: 'poi_index', scope: 'Chennai', complete: false,
    })
    const f = await coverageFactor('poi_index', 'Chennai')
    expect(f.cap).toBe(0.74)
    expect(bandFor(f.cap)).toBe('MODERATE') // specifically: not HIGH
    expect(f.reason).toMatch(/didn't finish/i)
    expect(f.reason).toMatch(/Chennai/)
    // Says what WE failed to do, not what the area lacks. Reading a thin count
    // as a quiet neighbourhood is our error presented as its character.
    expect(f.reason).toMatch(/our last download/i)
    // And no machine vocabulary: `poi_index` is our word, not a user's.
    expect(f.reason).not.toMatch(/poi_index|poi index/i)
  })

  it('says nothing when the run completed', async () => {
    prismaMock.dataQualityReport.findFirst.mockResolvedValue({
      dataset: 'poi_index', scope: 'Chennai', complete: true,
    })
    expect(await coverageFactor('poi_index', 'Chennai')).toBeNull()
  })

  it('does not penalise a dataset that has no report at all', async () => {
    // The dev DB holds 114k POIs seeded before quality reporting existed.
    // Treating a missing receipt as evidence of a bad delivery would degrade
    // every card until the next re-seed.
    prismaMock.dataQualityReport.findFirst.mockResolvedValue(null)
    expect(await coverageFactor('poi_index', 'Chennai')).toBeNull()
  })

  it('never lets a bookkeeping failure break the read path', async () => {
    prismaMock.dataQualityReport.findFirst.mockRejectedValue(new Error('db down'))
    await expect(coverageFactor('poi_index', 'Chennai')).resolves.toBeNull()
  })
})
