// The quality readout, and the AI tool surface over it.
//
// Two properties are worth more than the rest here:
//   1. "Never scored" is never folded into "scored badly". Before the job runs
//      every row is unscored, and a dashboard that reports that as 0% high
//      confidence describes an un-run job as a database full of bad data.
//   2. An agent cannot state a POI as fact that we have not measured. The tool
//      returns UNKNOWN, not 0, and nothing in this registry writes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { getPoiQuality } from '../src/features/spatial/poiQuality.service.js'
import { TOOLS, TOOL_NAMES, runTool } from '../src/features/graph/tools.js'

const NOW = new Date('2026-08-11T00:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(0)
  prismaMock.poiIndex.groupBy.mockResolvedValue([])
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.poiIndex.findFirst.mockResolvedValue(null)
  prismaMock.poiConflict.count.mockResolvedValue(0)
  prismaMock.poiConflict.groupBy.mockResolvedValue([])
  prismaMock.poiConflict.findMany.mockResolvedValue([])
  prismaMock.poiStatusEvent.groupBy.mockResolvedValue([])
})

describe('getPoiQuality', () => {
  it('quotes confidence rates against SCORED rows, not everything', async () => {
    // 1000 rows, 900 never scored, 80 of the 100 scored are high. The honest
    // headline is 80%, not 8%: the 900 are a coverage fact, not a quality one.
    prismaMock.poiIndex.count
      .mockResolvedValueOnce(1000) // total
      .mockResolvedValueOnce(0)    // absent
      .mockResolvedValueOnce(900)  // unscored
      .mockResolvedValueOnce(80)   // high
      .mockResolvedValueOnce(5)    // low
      .mockResolvedValueOnce(0)    // contradicted
      .mockResolvedValueOnce(0)    // verified

    const r = await getPoiQuality({ now: NOW })

    expect(r.headline.scored).toBe(100)
    expect(r.headline.unscored).toBe(900)
    expect(r.headline.highConfidencePct).toBe(80)
  })

  it('reports null rather than 0% when nothing has been scored at all', async () => {
    // 0/0 is not 0%. A fresh database must not read as a database of bad data.
    prismaMock.poiIndex.count
      .mockResolvedValueOnce(500).mockResolvedValueOnce(0).mockResolvedValueOnce(500)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0)

    const r = await getPoiQuality({ now: NOW })
    expect(r.headline.highConfidencePct).toBeNull()
    expect(r.headline.lowConfidencePct).toBeNull()
  })

  it('judges staleness against each category\'s OWN cadence', async () => {
    // Two groupBy calls share this mock — freshness-by-category first, then
    // by-city. Mocked per call rather than once, because they return genuinely
    // different shapes and a single value would feed city rows to the freshness
    // reader.
    prismaMock.poiIndex.groupBy
      .mockResolvedValueOnce([
        { category: 'metro_station', _count: { _all: 40 }, _min: { fetchedAt: daysAgo(200) }, _max: { fetchedAt: NOW } },
        { category: 'cafe', _count: { _all: 900 }, _min: { fetchedAt: daysAgo(200) }, _max: { fetchedAt: NOW } },
      ])
      .mockResolvedValueOnce([
        { city: 'Bengaluru', _count: { _all: 940 }, _avg: { trustScore: 78.4 } },
      ])

    const r = await getPoiQuality({ now: NOW })
    const by = Object.fromEntries(r.freshness.map((f) => [f.category, f]))
    // Same age, opposite verdicts — which is the entire point of the policy
    // table and the thing a single "average age" column cannot express.
    expect(by.metro_station.overdue).toBe(false)
    expect(by.cafe.overdue).toBe(true)
  })

  it('never sums openings and closures into one churn figure', async () => {
    prismaMock.poiStatusEvent.groupBy.mockResolvedValue([
      { toStatus: 'ABSENT_FROM_SOURCE', _count: { _all: 30 } },
      { toStatus: 'ACTIVE', _count: { _all: 12 } },
    ])
    const r = await getPoiQuality({ now: NOW })
    expect(r.churn).toMatchObject({ wentAbsent: 30, returned: 12 })
    expect(r.churn).not.toHaveProperty('total')
  })

  it('surfaces withheld conflicts separately from open ones', async () => {
    // "We are knowingly serving something the source disputes" is a different
    // and sharper claim than "somebody has not triaged this yet".
    prismaMock.poiConflict.groupBy
      .mockResolvedValueOnce([{ attribute: 'location', status: 'OPEN', _count: { _all: 9 } }])
      .mockResolvedValueOnce([{ attribute: 'location', _count: { _all: 2 } }])

    const r = await getPoiQuality({ now: NOW })
    expect(r.conflicts.location).toEqual({ total: 9, open: 9, withheld: 2 })
  })

  it('returns null rather than throwing into the admin panel', async () => {
    prismaMock.poiIndex.count.mockRejectedValue(new Error('connection lost'))
    expect(await getPoiQuality({ now: NOW })).toBeNull()
  })
})

// ── The AI boundary ─────────────────────────────────────────────────────────

describe('POI tools cannot invent a place', () => {
  it('are registered in the same gated registry as everything else', () => {
    expect(TOOL_NAMES).toContain('getPoiTrust')
    expect(TOOL_NAMES).toContain('getPoiConflicts')
  })

  it('reports UNKNOWN for a POI nobody has scored — never 0', async () => {
    // The distinction the tool exists for. A caller that cannot tell "we never
    // looked" from "we looked and doubt it" will phrase both as certainty.
    prismaMock.poiIndex.findFirst.mockResolvedValue({
      id: 'p1', osmId: 'node/1', name: 'Apollo Pharmacy', category: 'pharmacy',
      city: 'Bengaluru', status: 'ACTIVE', trustScore: null, trustReasons: null,
      confidence: null, scoredAt: null, verificationStatus: 'UNVERIFIED',
      verificationMethod: null, verifiedAt: null, fetchedAt: NOW,
    })

    const r = await runTool('getPoiTrust', { poiId: 'p1' })
    expect(r.ok).toBe(true)
    expect(r.data.trust).toBe('UNKNOWN')
    expect(r.data.band).toBe('UNKNOWN')
    expect(r.data.trust).not.toBe(0)
  })

  it('reports UNKNOWN for a POI that does not exist', async () => {
    const r = await runTool('getPoiTrust', { osmId: 'node/does-not-exist' })
    expect(r.data).toMatchObject({ found: false, trust: 'UNKNOWN' })
  })

  it('says plainly when the source no longer lists a place', async () => {
    prismaMock.poiIndex.findFirst.mockResolvedValue({
      id: 'p1', osmId: 'node/1', name: 'Closed Cafe', category: 'cafe', city: 'Bengaluru',
      status: 'ABSENT_FROM_SOURCE', trustScore: 22,
      trustReasons: { band: 'MINIMAL', reasons: [] }, confidence: {}, scoredAt: NOW,
      verificationStatus: 'UNVERIFIED', verificationMethod: null, verifiedAt: null, fetchedAt: NOW,
    })
    const r = await runTool('getPoiTrust', { poiId: 'p1' })
    // The one state where repeating what we hold would be actively wrong.
    expect(r.data.stillListed).toBe(false)
  })

  it('refuses a lookup with no identifier', async () => {
    // No name search, deliberately: resolving "the Apollo near Koramangala" to
    // one row is exactly the guess this tool exists to prevent.
    const r = await runTool('getPoiTrust', {})
    expect(r.ok).toBe(false)
    expect(r.error).toBe('INVALID_ARGUMENTS')
  })

  it('has no name-search parameter at all', () => {
    const shape = TOOLS.getPoiTrust.input._def.schema?.shape ?? TOOLS.getPoiTrust.input.shape
    expect(Object.keys(shape ?? {}).sort()).toEqual(['osmId', 'poiId'])
  })

  it('flags a disputed coordinate rather than leaving it to be inferred', async () => {
    prismaMock.poiConflict.findMany.mockResolvedValue([
      { attribute: 'location', currentValue: 'a', incomingValue: 'b', source: 'osm',
        distanceM: 4200, applied: false, status: 'OPEN', detectedAt: NOW },
    ])
    const r = await runTool('getPoiConflicts', { poiId: 'p1' })
    expect(r.data.servingDisputedLocation).toBe(true)
  })

  it('clamps its own limit', async () => {
    await runTool('getPoiConflicts', { poiId: 'p1', limit: 9999 })
    // Rejected by the schema before it reaches the handler — the ceiling is the
    // gate, not a suggestion the handler is trusted to honour.
    const r = await runTool('getPoiConflicts', { poiId: 'p1', limit: 9999 })
    expect(r.ok).toBe(false)
  })

  it('writes nothing', async () => {
    prismaMock.poiIndex.findFirst.mockResolvedValue(null)
    await runTool('getPoiTrust', { poiId: 'p1' })
    await runTool('getPoiConflicts', { poiId: 'p1' })
    expect(prismaMock.poiIndex.update).not.toHaveBeenCalled()
    expect(prismaMock.poiIndex.upsert).not.toHaveBeenCalled()
    expect(prismaMock.poiIndex.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.poiIndex.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.poiConflict.updateMany).not.toHaveBeenCalled()
  })
})
