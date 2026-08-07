/**
 * The ranking pipeline — 2026-08-07
 *
 * Three properties are load-bearing and each has a specific failure mode:
 *
 *   1. A component that cannot be computed is DROPPED, not zeroed. Zeroing
 *      pushes every listing down equally (noise) and makes totals incomparable
 *      between a query that supplied a commute destination and one that did not.
 *   2. Weights come from configuration with code defaults, so an empty table is
 *      a working system — a fresh checkout must rank exactly like production.
 *   3. Nothing in the agent layer can write them. Structural: no writer is
 *      exported from ranking.js at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import * as rankingModule from '../src/features/graph/ranking.js'
import {
  rank, scoreProperty, getWeights, resetWeightCache, DEFAULT_WEIGHTS,
} from '../src/features/graph/ranking.js'

const CENTER = { lat: 12.9352, lng: 77.6245 }
const NOW = new Date('2026-08-07T00:00:00Z')

const listing = (over = {}) => ({
  id: 'a', type: 'APARTMENT', rent: 30000,
  lat: 12.9352, lng: 77.6245, createdAt: NOW,
  trustScore: { overallScore: 80 }, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  resetWeightCache()
  prismaMock.rankingWeights.findUnique.mockResolvedValue(null)
})

describe('weights', () => {
  it('falls back to the code defaults when no profile is stored', async () => {
    const weights = await getWeights()
    // Normalised, so compare shape and ordering rather than raw values.
    expect(Object.keys(weights).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort())
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
  })

  it('normalises a stored profile that does not sum to 1', async () => {
    prismaMock.rankingWeights.findUnique.mockResolvedValue({
      weights: { location: 10, budget: 10, commute: 0, preference: 0, trust: 0, freshness: 0 },
    })
    const weights = await getWeights()
    expect(weights.location).toBeCloseTo(0.5, 6)
    expect(weights.budget).toBeCloseTo(0.5, 6)
  })

  it('ignores an unknown key and defaults a missing one', async () => {
    prismaMock.rankingWeights.findUnique.mockResolvedValue({
      weights: { location: 1, nonsense: 99 },
    })
    const weights = await getWeights()
    expect(weights).not.toHaveProperty('nonsense')
    expect(Object.keys(weights).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort())
  })

  it('still ranks when the weights table cannot be read at all', async () => {
    prismaMock.rankingWeights.findUnique.mockRejectedValue(new Error('relation does not exist'))
    const weights = await getWeights()
    // Defaults are a correct answer, not a degraded one — a database problem
    // must not stop the site ordering results.
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
  })

  it('exports no way for a caller to WRITE weights', () => {
    // The guarantee is structural, not a promise in a prompt: a model that can
    // set its own weights can justify any ordering after the fact.
    const writers = Object.keys(rankingModule).filter((k) => /^(set|update|save|write)/i.test(k))
    expect(writers).toEqual([])
  })
})

describe('components are dropped, never zeroed', () => {
  it('omits commute entirely when no destination was given', () => {
    const components = scoreProperty(listing(), { center: CENTER, now: NOW })
    expect(components).not.toHaveProperty('commute')
  })

  it('omits budget when the search had none', () => {
    const components = scoreProperty(listing(), { center: CENTER, now: NOW })
    expect(components).not.toHaveProperty('budget')
  })

  it('omits trust when a listing has never been scored', () => {
    const components = scoreProperty(listing({ trustScore: null }), { center: CENTER, now: NOW })
    expect(components).not.toHaveProperty('trust')
  })

  it('reports what it skipped on every ranked result', () => {
    const [top] = rank([listing()], { center: CENTER, now: NOW }, DEFAULT_WEIGHTS)
    expect(top.ranking.skipped).toEqual(expect.arrayContaining(['commute', 'budget', 'preference']))
  })

  it('does not let an absent component drag a listing below a present bad one', () => {
    // Two identical listings; one has no trust score, one has a terrible score.
    // The unscored one must not be treated as though it scored zero.
    const unscored = rank([listing({ id: 'x', trustScore: null })], { center: CENTER, now: NOW }, DEFAULT_WEIGHTS)[0]
    const bad = rank([listing({ id: 'y', trustScore: { overallScore: 0 } })], { center: CENTER, now: NOW }, DEFAULT_WEIGHTS)[0]
    expect(unscored.ranking.score).toBeGreaterThan(bad.ranking.score)
  })
})

describe('individual components behave', () => {
  it('scores budget 1 inside the range and decays above it', () => {
    const inside = scoreProperty(listing({ rent: 30000 }), { budget: { min: 20000, max: 40000 }, now: NOW })
    const over = scoreProperty(listing({ rent: 50000 }), { budget: { min: 20000, max: 40000 }, now: NOW })
    const wayOver = scoreProperty(listing({ rent: 90000 }), { budget: { min: 20000, max: 40000 }, now: NOW })

    expect(inside.budget).toBe(1)
    expect(over.budget).toBeLessThan(1)
    // 50% over budget is not an option however good it is.
    expect(wayOver.budget).toBe(0)
  })

  it('reads a short stay\'s nightly rate for budget, not its monthly field', () => {
    const stay = listing({ type: 'SHORT_STAY', nightlyRate: 2500, rent: 999999 })
    const components = scoreProperty(stay, { budget: { min: 2000, max: 3000 }, now: NOW })
    expect(components.budget).toBe(1)
  })

  it('decays freshness smoothly rather than off a cliff', () => {
    const day = 86_400_000
    const fresh = scoreProperty(listing({ createdAt: NOW }), { now: NOW }).freshness
    const month = scoreProperty(listing({ createdAt: new Date(NOW - 30 * day) }), { now: NOW }).freshness
    const year = scoreProperty(listing({ createdAt: new Date(NOW - 365 * day) }), { now: NOW }).freshness

    expect(fresh).toBe(1)
    expect(month).toBeCloseTo(0.5, 2)
    expect(year).toBeGreaterThan(0)
    expect(year).toBeLessThan(0.05)
  })

  it('scores preference from what the person actually engaged with', () => {
    const preferences = { types: ['APARTMENT'], localityIds: ['loc1'], budget: { min: 25000, max: 35000 } }
    const match = scoreProperty(listing({ localityId: 'loc1' }), { preferences, now: NOW })
    const miss = scoreProperty(listing({ type: 'LAND', localityId: 'loc9', rent: 9000000 }), { preferences, now: NOW })

    expect(match.preference).toBe(1)
    expect(miss.preference).toBe(0)
  })
})

describe('rank()', () => {
  it('is pure — it performs no I/O', async () => {
    rank([listing()], { center: CENTER, now: NOW }, DEFAULT_WEIGHTS)
    expect(prismaMock.rankingWeights.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.property.findMany).not.toHaveBeenCalled()
  })

  it('orders by score, highest first', () => {
    const results = rank([
      listing({ id: 'far', lat: 12.9852, lng: 77.6745 }),
      listing({ id: 'here' }),
    ], { center: CENTER, radiusM: 8000, now: NOW }, DEFAULT_WEIGHTS)

    expect(results[0].id).toBe('here')
    expect(results[0].ranking.score).toBeGreaterThan(results[1].ranking.score)
  })

  it('is deterministic — the same input ranks the same way twice', () => {
    const input = [listing({ id: 'a' }), listing({ id: 'b', rent: 60000 })]
    const first = rank(input, { center: CENTER, budget: { max: 40000 }, now: NOW }, DEFAULT_WEIGHTS)
    const second = rank(input, { center: CENTER, budget: { max: 40000 }, now: NOW }, DEFAULT_WEIGHTS)
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id))
    expect(first[0].ranking.score).toBe(second[0].ranking.score)
  })

  it('explains every result it returns', () => {
    const [top] = rank([listing()], { center: CENTER, budget: { max: 40000 }, now: NOW }, DEFAULT_WEIGHTS)
    expect(top.ranking).toHaveProperty('score')
    expect(top.ranking).toHaveProperty('components')
    expect(top.ranking).toHaveProperty('skipped')
    expect(top.ranking.components.budget).toBe(1)
  })

  it('returns a zero score rather than NaN when nothing can be scored', () => {
    const [only] = rank([{ id: 'bare' }], {}, DEFAULT_WEIGHTS)
    expect(only.ranking.score).toBe(0)
    expect(Number.isNaN(only.ranking.score)).toBe(false)
  })

  it('honours a changed weight profile', () => {
    const budgetOnly = { location: 0, budget: 1, commute: 0, preference: 0, trust: 0, freshness: 0 }
    const results = rank([
      listing({ id: 'cheap-far', rent: 30000, lat: 12.99, lng: 77.68 }),
      listing({ id: 'pricey-here', rent: 90000 }),
    ], { center: CENTER, radiusM: 8000, budget: { max: 35000 }, now: NOW }, budgetOnly)

    // With location weighted to nothing, the on-budget listing wins despite
    // being further away.
    expect(results[0].id).toBe('cheap-far')
  })
})
