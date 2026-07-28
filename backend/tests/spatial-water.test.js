// Water bodies — geometry maths, the three-way availability contract, and the
// refusal that matters most.
//
// The refusal tests are not decoration. `terrain.module.js` says in its own
// comments that `water_distance` + `flood_history` are "what would turn 'this
// ground is low' into 'this place floods'". Half of that pair now exists, which
// means a card can show "sits 4 m lower than its surroundings" directly above
// "lake 200 m away". Neither sentence claims flood risk; together they invite
// the inference. These tests pin the vocabulary so a future well-meaning copy
// edit cannot quietly complete the sentence.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { waterBody: { findMany: vi.fn(), count: vi.fn(async () => 1) } },
}))
vi.mock('../src/lib/redis.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
}))
// Elevation is stubbed because these tests are about WATER. Left real, they
// reach OpenTopoData over the network and pass or fail depending on whether
// that call succeeds — which is how the first version of this file passed alone
// and failed inside the suite. A terrain reading is a precondition here, not
// the thing under test.
vi.mock('../src/features/spatial/providers.js', () => ({
  elevation: vi.fn(async () => ({
    elevationM: 920, relativeM: -4.2, reliefM: 12, sampleCount: 9,
  })),
  SRTM_SOURCE: { id: 'srtm', label: 'NASA SRTM', licence: 'public domain' },
}))

const { prisma } = await import('../src/lib/prisma.js')
const { distanceToGeometry, nearestWater, MIN_AREA_SQM } = await import(
  '../src/features/spatial/waterLookup.js'
)
const terrain = (await import('../src/features/spatial/modules/terrain.module.js')).default

// A ~1.1 km square with its south-west corner at (12.90, 77.60). One degree of
// latitude is ~111.32 km, so 0.01° is ~1113 m — round numbers to assert against.
const SQUARE = {
  type: 'Polygon',
  coordinates: [[
    [77.60, 12.90], [77.61, 12.90], [77.61, 12.91], [77.60, 12.91], [77.60, 12.90],
  ]],
}

describe('distanceToGeometry', () => {
  it('is 0 inside the polygon — never negative', () => {
    // A point in the lake and a point on its bank are both "at the water". A
    // negative distance would imply a depth we have no data for.
    const hit = distanceToGeometry(12.905, 77.605, SQUARE)
    expect(hit.distanceM).toBe(0)
    expect(hit.inside).toBe(true)
  })

  it('measures to the nearest EDGE, not the centroid', () => {
    // 0.001° north of the top edge ≈ 111 m. A centroid measurement would say
    // ~600 m, which is the error this whole file exists to avoid.
    const hit = distanceToGeometry(12.911, 77.605, SQUARE)
    expect(hit.distanceM).toBeGreaterThan(100)
    expect(hit.distanceM).toBeLessThan(125)
    expect(hit.inside).toBe(false)
  })

  it('returns a real coordinate in `at`, so the fact can be re-anchored', () => {
    // reanchor.js and walkEnrich.js both key off `at`. Without it this fact
    // would be the one distance on the card that cannot follow the property.
    const hit = distanceToGeometry(12.911, 77.605, SQUARE)
    expect(typeof hit.at.lat).toBe('number')
    expect(typeof hit.at.lng).toBe('number')
  })

  it('handles MultiPolygon and survives a degenerate ring', () => {
    const multi = { type: 'MultiPolygon', coordinates: [SQUARE.coordinates] }
    expect(distanceToGeometry(12.905, 77.605, multi).distanceM).toBe(0)
    // Duplicated vertices are common in OSM rings and must not divide by zero.
    const degenerate = {
      type: 'Polygon',
      coordinates: [[[77.60, 12.90], [77.60, 12.90], [77.60, 12.90]]],
    }
    expect(() => distanceToGeometry(12.905, 77.605, degenerate)).not.toThrow()
  })

  it('returns null for geometry it cannot read', () => {
    expect(distanceToGeometry(12.9, 77.6, null)).toBeNull()
    expect(distanceToGeometry(12.9, 77.6, { type: 'Point', coordinates: [77.6, 12.9] })).toBeNull()
  })
})

describe('nearestWater — the three-way contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Seeded, unless a test says otherwise.
    prisma.waterBody.count.mockResolvedValue(1)
  })

  it('an UNSEEDED table is "could not look", never "there is no water"', async () => {
    // The bug this guards, caught 2026-07-28 before it reached production: an
    // empty table returned "we looked, found none within 3 km" — a confident
    // false statement — AND counted water_distance as a present input, raising
    // the module's confidence on the basis of no data whatsoever.
    prisma.waterBody.count.mockResolvedValue(0)
    expect(await nearestWater(12.9352, 77.6245)).toBeNull()
    // …and it must not even reach the scan.
    expect(prisma.waterBody.findMany).not.toHaveBeenCalled()
  })

  it('distinguishes "could not look" from "looked, found none"', async () => {
    // The distinction providers.js draws. Collapsing them makes an unseeded
    // city look like a desert, which is a lie the layer exists to prevent.
    prisma.waterBody.findMany.mockRejectedValueOnce(new Error('no table'))
    expect(await nearestWater(12.9, 77.6)).toBeNull()

    prisma.waterBody.findMany.mockResolvedValueOnce([])
    expect(await nearestWater(12.9, 77.6)).toEqual({ available: true, body: null })
  })

  it('picks the closest, and breaks ties toward the larger body', async () => {
    // Standing between a lake and the drain feeding it, the lake is the answer
    // a person expects.
    prisma.waterBody.findMany.mockResolvedValueOnce([
      { name: 'Small Tank', kind: 'tank', geometry: SQUARE, areaSqM: 5_000 },
      { name: 'Big Lake', kind: 'lake', geometry: SQUARE, areaSqM: 900_000 },
    ])
    const res = await nearestWater(12.905, 77.605)
    expect(res.body.name).toBe('Big Lake')
  })

  it('excludes bodies beyond the radius rather than reporting a far one', async () => {
    prisma.waterBody.findMany.mockResolvedValueOnce([
      { name: 'Far Lake', kind: 'lake', geometry: SQUARE, areaSqM: 900_000 },
    ])
    // ~5.5 km north of the square, outside the 3 km default.
    const res = await nearestWater(12.96, 77.605)
    expect(res).toEqual({ available: true, body: null })
  })

  it('asks the database to drop puddles', async () => {
    prisma.waterBody.findMany.mockResolvedValueOnce([])
    await nearestWater(12.9, 77.6)
    const where = prisma.waterBody.findMany.mock.calls[0][0].where
    // A fountain or a swimming pool tagged as water must never surface as
    // "your nearest lake".
    expect(where.OR).toEqual([{ areaSqM: null }, { areaSqM: { gte: MIN_AREA_SQM } }])
  })

  it('uses a bbox INTERSECTION, not Boundary’s containment test', async () => {
    prisma.waterBody.findMany.mockResolvedValueOnce([])
    await nearestWater(12.9, 77.6)
    const where = prisma.waterBody.findMany.mock.calls[0][0].where
    // Containment (minLat <= lat AND maxLat >= lat) would only ever find bodies
    // the point is already standing inside — i.e. distance 0 or nothing.
    expect(where.minLat.lte).toBeGreaterThan(12.9)
    expect(where.maxLat.gte).toBeLessThan(12.9)
  })
})

describe('the flood refusal survives water landing', () => {
  const RISK_WORDS = /flood|risk|hazard|danger|unsafe|prone|liable to|waterlog/i

  it('the water fact states a location and never a hazard', async () => {
    prisma.waterBody.findMany.mockResolvedValue([
      { name: 'Bellandur Lake', kind: 'lake', geometry: SQUARE, areaSqM: 900_000 },
    ])
    const out = await terrain.compute({ lat: 12.911, lng: 77.605, propertyType: 'APARTMENT' })
    const water = out.facts.find((f) => f.key === 'nearest_water')

    expect(water).toBeTruthy()
    expect(water.display).not.toMatch(RISK_WORDS)
    expect(water.label).not.toMatch(RISK_WORDS)
    expect(water.method).not.toMatch(RISK_WORDS)
  })

  it('still says plainly that it is not flood risk', async () => {
    prisma.waterBody.findMany.mockResolvedValue([
      { name: 'Bellandur Lake', kind: 'lake', geometry: SQUARE, areaSqM: 900_000 },
    ])
    const out = await terrain.compute({ lat: 12.911, lng: 77.605, propertyType: 'APARTMENT' })
    // Having water distance must not read as having answered the flood
    // question. The caveat is the thing that keeps the two claims apart.
    expect(out.missing.join(' ')).toMatch(/not flood risk/i)
    expect(out.missing.join(' ')).toMatch(/flood history is not shown|no parcel-level flood record/i)
  })

  it('is DERIVED, not MEASURED — haversine is arithmetic', async () => {
    prisma.waterBody.findMany.mockResolvedValue([
      { name: 'Bellandur Lake', kind: 'lake', geometry: SQUARE, areaSqM: 900_000 },
    ])
    const out = await terrain.compute({ lat: 12.911, lng: 77.605, propertyType: 'APARTMENT' })
    const water = out.facts.find((f) => f.key === 'nearest_water')
    // The one place this layer broke its own contract before, per the
    // 2026-07-19 accuracy audit. Distance between measured points is DERIVED.
    expect(water.provenance).toBe('DERIVED')
  })

  it('counts water as an input only when the lookup actually answered', async () => {
    prisma.waterBody.findMany.mockRejectedValueOnce(new Error('down'))
    const out = await terrain.compute({ lat: 12.911, lng: 77.605, propertyType: 'APARTMENT' })
    expect(out.inputsPresent).not.toContain('water_distance')
    // …and says so, rather than silently scoring lower for no stated reason.
    expect(out.missing.join(' ')).toMatch(/not yet available/i)
  })

  it('"no water within 3 km" is an answer, not a gap', async () => {
    prisma.waterBody.findMany.mockResolvedValue([])
    const out = await terrain.compute({ lat: 12.911, lng: 77.605, propertyType: 'APARTMENT' })
    expect(out.inputsPresent).toContain('water_distance')
    const water = out.facts.find((f) => f.key === 'nearest_water')
    expect(water.value).toBeNull()
    expect(water.display).toMatch(/no mapped lake, river or canal/i)
  })
})
