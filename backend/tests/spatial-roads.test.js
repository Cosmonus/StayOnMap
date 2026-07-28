// Road access — the input that had held landContext at 0.19 against a ceiling
// of 0.50, the weakest module in the layer.
//
// The behaviour worth protecting is the TWO-distance answer. A plot 30 m from a
// dirt track and 900 m from tarmac is not "30 m from a road" in any sense a
// buyer means, and a single nearest-road number says exactly that. These tests
// pin the gap.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { roadSegment: { findMany: vi.fn(), count: vi.fn() } },
}))
vi.mock('../src/lib/redis.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
}))
// landContext's POI half is not under test here, and left real it reaches the
// database. Its absence is a supported state, which is what this returns.
vi.mock('../src/features/spatial/poiProvider.js', () => ({
  poisNear: vi.fn(async () => ({
    available: false, byCategory: {}, total: 0, truncated: false,
    sparselyMapped: false, fetchedAt: null,
  })),
  pickNearest: (hits) => hits[0],
  poiConfidenceFactors: vi.fn(async () => []),
  OSM_POI_SOURCE: { id: 'osm-poi', label: 'OpenStreetMap', licence: 'ODbL' },
  OSM_POI_SOURCE_ID: 'osm-poi',
}))

const { prisma } = await import('../src/lib/prisma.js')
const { roadAccess, ROAD_CLASS_RANK, DRIVEABLE, labelFor } = await import(
  '../src/features/spatial/roadLookup.js'
)
const landContext = (await import('../src/features/spatial/modules/landContext.module.js')).default

// A north-south line at lng 77.600, from lat 12.900 to 12.910.
const line = (lng) => ({
  type: 'LineString',
  coordinates: [[lng, 12.900], [lng, 12.910]],
})

const TRACK = { name: null, highway: 'track', widthM: null, paved: null, geometry: line(77.6000) }
// ~0.009° east of the track ≈ 975 m at this latitude.
const TARMAC = { name: 'Hosur Road', highway: 'primary', widthM: 12, paved: true, geometry: line(77.6090) }

describe('road class vocabulary', () => {
  it('keeps `track` motorable but never driveable', () => {
    // It is in the table precisely because "reachable, but only by track" is a
    // real answer. Calling it driveable would be the lie this module avoids.
    expect(ROAD_CLASS_RANK.track).toBe(0)
    expect(DRIVEABLE).not.toContain('track')
    expect(DRIVEABLE).toContain('service')
  })

  it('labels an unknown class rather than rendering nothing', () => {
    // The amenities silent-mismatch lesson: an unmapped key must degrade, not
    // disappear.
    expect(labelFor('primary')).toBe('main road')
    expect(labelFor('busway')).toBe('road')
  })
})

describe('roadAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('distinguishes "could not look" from "looked, found none"', async () => {
    prisma.roadSegment.findMany.mockRejectedValueOnce(new Error('no table'))
    expect(await roadAccess(12.905, 77.601)).toBeNull()

    prisma.roadSegment.findMany.mockResolvedValueOnce([])
    const none = await roadAccess(12.905, 77.601)
    expect(none).toEqual({ available: true, nearest: null, driveable: null })
  })

  it('reports the track as nearest and the tarmac as driveable', async () => {
    prisma.roadSegment.findMany.mockResolvedValueOnce([TRACK, TARMAC])
    const res = await roadAccess(12.905, 77.6005)

    expect(res.nearest.highway).toBe('track')
    expect(res.nearest.distanceM).toBeLessThan(100)
    expect(res.driveable.highway).toBe('primary')
    expect(res.driveable.distanceM).toBeGreaterThan(800)
  })

  it('asks the database only for motorable classes', async () => {
    prisma.roadSegment.findMany.mockResolvedValueOnce([])
    await roadAccess(12.905, 77.601)
    const where = prisma.roadSegment.findMany.mock.calls[0][0].where
    // Footways and cycleways are the majority of highway=* in a mapped city and
    // none of them carries a vehicle.
    expect(where.highway.in).not.toContain('footway')
    expect(where.highway.in).toContain('track')
  })

  it('makes one scan, not two', async () => {
    prisma.roadSegment.findMany.mockResolvedValueOnce([TRACK, TARMAC])
    await roadAccess(12.905, 77.6005)
    // Both answers come from filtering one candidate set. A second query would
    // re-read rows already in hand.
    expect(prisma.roadSegment.findMany).toHaveBeenCalledTimes(1)
  })
})

describe('landContext road facts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('emits the second fact only when it says something new', async () => {
    // Track 30 m away, tarmac ~975 m away — the gap IS the finding.
    prisma.roadSegment.findMany.mockResolvedValue([TRACK, TARMAC])
    const out = await landContext.compute({ lat: 12.905, lng: 77.6005, city: 'Bengaluru' })

    expect(out.inputsPresent).toContain('road_access')
    const nearest = out.facts.find((f) => f.key === 'nearest_road')
    const driveable = out.facts.find((f) => f.key === 'nearest_driveable_road')
    expect(nearest.display).toMatch(/unsurfaced track/i)
    expect(driveable.display).toMatch(/Hosur Road/)

    // Same road for both: the second fact would just repeat the first.
    prisma.roadSegment.findMany.mockResolvedValue([TARMAC])
    const onStreet = await landContext.compute({ lat: 12.905, lng: 77.6089, city: 'Bengaluru' })
    expect(onStreet.facts.find((f) => f.key === 'nearest_driveable_road')).toBeUndefined()
  })

  it('says plainly when nothing is driveable within range', async () => {
    prisma.roadSegment.findMany.mockResolvedValue([TRACK])
    const out = await landContext.compute({ lat: 12.905, lng: 77.6005, city: 'Bengaluru' })
    const driveable = out.facts.find((f) => f.key === 'nearest_driveable_road')
    expect(driveable.value).toBeNull()
    expect(driveable.display).toMatch(/none within/i)
  })

  it('shows a measured width only when OSM recorded one', async () => {
    prisma.roadSegment.findMany.mockResolvedValue([TARMAC])
    const withWidth = await landContext.compute({ lat: 12.905, lng: 77.6089, city: 'Bengaluru' })
    expect(withWidth.facts.find((f) => f.key === 'nearest_road').display).toMatch(/12 m wide/)

    prisma.roadSegment.findMany.mockResolvedValue([
      { ...TARMAC, widthM: null },
    ])
    const without = await landContext.compute({ lat: 12.905, lng: 77.6089, city: 'Bengaluru' })
    // Silence, not a guessed width. The listing's own stated width is the
    // owner's claim and this module must not appear to corroborate it.
    expect(without.facts.find((f) => f.key === 'nearest_road').display).not.toMatch(/wide/)
  })

  it('scores no road input when the lookup failed, and says so', async () => {
    prisma.roadSegment.findMany.mockRejectedValue(new Error('down'))
    const out = await landContext.compute({ lat: 12.905, lng: 77.6005, city: 'Bengaluru' })
    expect(out.inputsPresent).not.toContain('road_access')
    expect(out.missing.join(' ')).toMatch(/nearest road is not yet available/i)
  })

  it('still refuses title, flood and water-table claims', async () => {
    // Road access must not make a thin module look like a complete answer to a
    // land purchase. These are the notes that keep that boundary.
    prisma.roadSegment.findMany.mockResolvedValue([TARMAC])
    const out = await landContext.compute({ lat: 12.905, lng: 77.6089, city: 'Bengaluru' })
    const prose = out.missing.join(' ')
    expect(prose).toMatch(/title, patta, encumbrance or approval/i)
    expect(prose).toMatch(/flood history is not available/i)
    expect(prose).toMatch(/water table depth/i)
  })
})
