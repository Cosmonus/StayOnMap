/**
 * Graph coverage — 2026-08-07
 *
 * The observability that matters at this stage is COVERAGE, not latency: every
 * failure in this layer so far has been something that was never computed, not
 * something that was slow. A listing with no SIMILAR_TO edges and a listing
 * whose edges are slow to read look identical to a user — an empty row — and
 * only one of those has ever actually happened.
 *
 * The specific trap this reports on: edges are built on create / edit /
 * moderation, so a listing that was ALREADY ACTIVE when the feature shipped
 * gets none until a backfill runs. That was a real defect in the first cut.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  getGraphHealth, recordToolTiming, resetToolTimings, toolLatency,
} from '../src/features/graph/health.js'

beforeEach(() => {
  vi.clearAllMocks()
  resetToolTimings()
  prismaMock.property.count.mockResolvedValue(0)
  prismaMock.propertySimilarity.findMany.mockResolvedValue([])
  prismaMock.propertySimilarity.count = vi.fn().mockResolvedValue(0)
  prismaMock.locality.count = vi.fn().mockResolvedValue(0)
  prismaMock.locality.groupBy = vi.fn().mockResolvedValue([])
  prismaMock.localityAlias.count = vi.fn().mockResolvedValue(0)
  prismaMock.imageFingerprint.count = vi.fn().mockResolvedValue(0)
  prismaMock.propertyImage.count = vi.fn().mockResolvedValue(0)
})

describe('coverage', () => {
  it('names the backfill when live listings have no edges — the actual defect', async () => {
    prismaMock.property.count.mockResolvedValue(13)
    prismaMock.propertySimilarity.findMany.mockResolvedValue([{ propertyId: 'a' }])

    const health = await getGraphHealth()

    expect(health.similarity.coveragePct).toBe(7.7)
    expect(health.similarity.remedy).toMatch(/backfill-similarity/)
  })

  it('offers no remedy once coverage is complete', async () => {
    prismaMock.property.count.mockResolvedValue(2)
    prismaMock.propertySimilarity.findMany.mockResolvedValue([{ propertyId: 'a' }, { propertyId: 'b' }])

    const health = await getGraphHealth()
    expect(health.similarity.coveragePct).toBe(100)
    expect(health.similarity.remedy).toBeNull()
  })

  it('counts DISTINCT listings, not edge rows — or coverage exceeds 100%', async () => {
    // 12 edges belong to one listing. Counting rows would report 1200%.
    prismaMock.property.count.mockResolvedValue(1)
    prismaMock.propertySimilarity.findMany.mockResolvedValue([{ propertyId: 'a' }])
    prismaMock.propertySimilarity.count.mockResolvedValue(12)

    const health = await getGraphHealth()
    expect(health.similarity.coveragePct).toBe(100)
    expect(health.similarity.totalEdges).toBe(12)
  })

  it('reports no percentage rather than 0% when there is nothing to divide by', async () => {
    // An empty database is not 0% covered — 0% would read as a broken system.
    const health = await getGraphHealth()
    expect(health.similarity.coveragePct).toBeNull()
    expect(health.images.coveragePct).toBeNull()
  })

  it('breaks localities down by source, so a missing boundary seed is visible', async () => {
    prismaMock.property.count.mockResolvedValue(10)
    prismaMock.locality.groupBy.mockResolvedValue([
      { source: 'LANDMARK', _count: { _all: 7 } },
      { source: 'BOUNDARY', _count: { _all: 1 } },
    ])

    const health = await getGraphHealth()
    // All-LANDMARK usually means fetch-osm-boundaries never ran for that city —
    // the entity still works, but it is merging spellings rather than naming
    // real wards.
    expect(health.locality.bySource).toEqual({ LANDMARK: 7, BOUNDARY: 1 })
  })

  it('never throws — a health check must not be the thing that breaks', async () => {
    prismaMock.property.count.mockRejectedValue(new Error('table missing'))
    await expect(getGraphHealth()).resolves.toBeNull()
  })
})

describe('tool latency', () => {
  it('reports p50 and p95 per tool', () => {
    for (let i = 1; i <= 100; i++) recordToolTiming('searchProperties', i, true)

    const [stat] = toolLatency()
    expect(stat.tool).toBe('searchProperties')
    expect(stat.calls).toBe(100)
    expect(stat.p50).toBe(50)
    expect(stat.p95).toBe(95)
  })

  it('counts failures separately from calls', () => {
    recordToolTiming('searchGraph', 10, true)
    recordToolTiming('searchGraph', 20, false)

    const [stat] = toolLatency()
    expect(stat.calls).toBe(2)
    expect(stat.failures).toBe(1)
  })

  it('bounds the sample so a long-lived process does not leak memory', () => {
    // An unbounded array of durations is a memory leak wearing a metrics costume.
    for (let i = 0; i < 500; i++) recordToolTiming('findRelated', i, true)

    const [stat] = toolLatency()
    expect(stat.calls).toBe(500)
    // Only the last 100 are retained, so p50 reflects RECENT calls rather than
    // a lifetime average that would hide a regression under months of good data.
    expect(stat.p50).toBeGreaterThan(400)
  })

  it('busiest tool first', () => {
    recordToolTiming('quiet', 5, true)
    for (let i = 0; i < 5; i++) recordToolTiming('busy', 5, true)

    expect(toolLatency()[0].tool).toBe('busy')
  })
})
