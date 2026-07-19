import { describe, it, expect, vi } from 'vitest'
import {
  assembleRings, ringsToGeometry, pointInGeometry, pointInRing, bboxOf,
} from '../src/features/spatial/boundaryGeometry.js'
import { completeness } from '../src/features/spatial/dataQuality.js'
import { summarise, monthName, NORMALS_PRECISION } from '../src/features/spatial/climate.js'
import { ADMIN_LEVEL_LABELS } from '../src/features/spatial/boundaryLookup.js'
import { PROVENANCE } from '../src/features/spatial/envelope.js'

// A 1°x1° square, given as four separate edges in scrambled order with two of
// them running backwards — which is exactly how OSM stores a boundary relation.
const SQUARE_EDGES = [
  [[1, 0], [1, 1]],           // east, forwards
  [[1, 1], [0, 1]],           // north, forwards
  [[0, 0], [1, 0]],           // south, forwards
  [[0, 0], [0, 1]].reverse(), // west, stored backwards
]

describe('assembleRings', () => {
  it('chains scrambled, mis-oriented segments into one closed ring', () => {
    const { rings, dropped } = assembleRings(SQUARE_EDGES)

    expect(dropped).toBe(0)
    expect(rings).toHaveLength(1)
    // Closed: first point equals last.
    expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1])
  })

  it('drops an unclosed ring rather than joining its loose ends', () => {
    // The same square missing its northern edge. Force-closing it would invent
    // a border, and every containment test afterwards would answer against the
    // invention rather than admitting the data is incomplete.
    const gapped = SQUARE_EDGES.slice(0, 3)
    const { rings, dropped } = assembleRings(gapped)

    expect(rings).toHaveLength(0)
    // Two open chains, not one: east+north join, and south is left stranded
    // because the missing western edge is what would have connected them.
    expect(dropped).toBe(2)
  })

  it('keeps separate closed rings separate', () => {
    const far = [[[10, 10], [11, 10]], [[11, 10], [11, 11]], [[11, 11], [10, 11]], [[10, 11], [10, 10]]]
    const { rings } = assembleRings([...SQUARE_EDGES, ...far])
    expect(rings).toHaveLength(2)
  })

  it('ignores degenerate segments', () => {
    const { rings } = assembleRings([...SQUARE_EDGES, [[5, 5]], []])
    expect(rings).toHaveLength(1)
  })
})

describe('ringsToGeometry', () => {
  const outer = assembleRings(SQUARE_EDGES).rings[0]

  it('returns a Polygon for a single ring', () => {
    const geometry = ringsToGeometry([outer])
    expect(geometry.type).toBe('Polygon')
    expect(geometry.coordinates).toHaveLength(1)
  })

  it('nests a contained ring as a hole, not as a second polygon', () => {
    // A small ring wholly inside the square — OSM's inner/outer roles are
    // frequently missing here, so containment is what decides.
    const hole = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]
    const geometry = ringsToGeometry([outer, hole])

    expect(geometry.type).toBe('Polygon')
    expect(geometry.coordinates).toHaveLength(2) // outer + one hole
  })

  it('returns a MultiPolygon for disjoint rings', () => {
    const far = assembleRings([
      [[10, 10], [11, 10]], [[11, 10], [11, 11]], [[11, 11], [10, 11]], [[10, 11], [10, 10]],
    ]).rings[0]

    const geometry = ringsToGeometry([outer, far])
    expect(geometry.type).toBe('MultiPolygon')
    expect(geometry.coordinates).toHaveLength(2)
  })

  it('returns null when there is nothing to build from', () => {
    expect(ringsToGeometry([])).toBeNull()
  })
})

describe('pointInGeometry', () => {
  const outer = assembleRings(SQUARE_EDGES).rings[0]
  const hole = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]
  const withHole = ringsToGeometry([outer, hole])

  it('finds a point inside', () => {
    expect(pointInGeometry({ lat: 0.2, lng: 0.2 }, withHole)).toBe(true)
  })

  it('rejects a point outside', () => {
    expect(pointInGeometry({ lat: 5, lng: 5 }, withHole)).toBe(false)
  })

  it('rejects a point in a hole — a courtyard is not in the ward', () => {
    expect(pointInGeometry({ lat: 0.5, lng: 0.5 }, withHole)).toBe(false)
  })

  it('handles MultiPolygon members independently', () => {
    const far = assembleRings([
      [[10, 10], [11, 10]], [[11, 10], [11, 11]], [[11, 11], [10, 11]], [[10, 11], [10, 10]],
    ]).rings[0]
    const multi = ringsToGeometry([outer, far])

    expect(pointInGeometry({ lat: 10.5, lng: 10.5 }, multi)).toBe(true)
    expect(pointInGeometry({ lat: 0.2, lng: 0.2 }, multi)).toBe(true)
    expect(pointInGeometry({ lat: 5, lng: 5 }, multi)).toBe(false)
  })

  it('is false, not throwing, for missing geometry', () => {
    expect(pointInGeometry({ lat: 0, lng: 0 }, null)).toBe(false)
    expect(pointInGeometry({ lat: 0, lng: 0 }, {})).toBe(false)
  })

  it('reads coordinates in GeoJSON [lng, lat] order', () => {
    // A tall, narrow box spanning lng 0..1 and lat 0..10. A point at
    // lat 5, lng 0.5 is inside; swapping the axes would put it outside.
    const tall = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 10], [0, 10], [0, 0]]] }
    expect(pointInGeometry({ lat: 5, lng: 0.5 }, tall)).toBe(true)
    expect(pointInGeometry({ lat: 0.5, lng: 5 }, tall)).toBe(false)
  })
})

describe('pointInRing', () => {
  const ring = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]

  it('handles a point on the far side of the ray', () => {
    expect(pointInRing([1, 1], ring)).toBe(true)
    expect(pointInRing([3, 1], ring)).toBe(false)
    expect(pointInRing([-1, 1], ring)).toBe(false)
  })
})

describe('bboxOf', () => {
  it('spans every ring of a MultiPolygon', () => {
    const multi = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]],
      ],
    }
    expect(bboxOf(multi)).toEqual({ minLat: 0, maxLat: 11, minLng: 0, maxLng: 11 })
  })

  it('returns null for empty geometry', () => {
    expect(bboxOf(null)).toBeNull()
  })
})

describe('completeness', () => {
  it('reports the share of rows carrying every critical field', () => {
    const rows = [{ name: 'A' }, { name: 'B' }, { name: null }, { name: '' }]
    expect(completeness(rows, ['name'])).toBe(50)
  })

  it('requires all critical fields, not any', () => {
    const rows = [{ name: 'A', category: 'x' }, { name: 'B', category: null }]
    expect(completeness(rows, ['name', 'category'])).toBe(50)
  })

  it('returns null for an empty set — 100% of nothing is not a quality signal', () => {
    expect(completeness([], ['name'])).toBeNull()
  })
})

describe('climate summarise', () => {
  // A monsoon city: almost all the rain in four months.
  const monsoon = {
    tempMean: [25, 27, 30, 32, 33, 30, 28, 28, 28, 28, 26, 25],
    precipSum: [2, 1, 3, 8, 30, 480, 620, 380, 240, 90, 20, 4],
  }

  it('totals annual rainfall and averages temperature', () => {
    const c = summarise(monsoon)
    expect(c.annualPrecip).toBe(1878)
    expect(c.meanTemp).toBeCloseTo(28.3, 1)
  })

  it('names the hottest and wettest months', () => {
    const c = summarise(monsoon)
    expect(c.hottestMonth).toBe('May')
    expect(c.wettestMonth).toBe('July')
    expect(c.wettestPrecip).toBe(620)
  })

  it('reports how concentrated the rain is — the fact an annual total hides', () => {
    const c = summarise(monsoon)
    // Jun+Jul+Aug+Sep = 1720 of 1878.
    expect(c.monsoonConcentration).toBe(92)
  })

  it('distinguishes an evenly-watered climate from a monsoon one', () => {
    const even = {
      tempMean: Array(12).fill(24),
      precipSum: Array(12).fill(100),
    }
    const c = summarise(even)
    expect(c.annualPrecip).toBe(1200)
    // Four of twelve equal months is a third of the rain.
    expect(c.monsoonConcentration).toBe(33)
  })

  it('does not divide by zero in a desert', () => {
    const dry = { tempMean: Array(12).fill(30), precipSum: Array(12).fill(0) }
    expect(summarise(dry).monsoonConcentration).toBeNull()
  })
})

describe('climate resolution', () => {
  it('stores normals coarser than the layer default, matching the source', () => {
    // ERA5's grid is ~28km. Storing at the layer's usual precision 7 (~153m)
    // would present one real value as thousands of distinct-looking ones.
    expect(NORMALS_PRECISION).toBeLessThan(7)
  })

  it('names months from 1, not 0', () => {
    expect(monthName(1)).toBe('January')
    expect(monthName(12)).toBe('December')
    expect(monthName(13)).toBeNull()
  })
})

describe('admin level labels', () => {
  it('covers every level the boundary seeder fetches', () => {
    for (const level of [6, 8, 9, 10]) {
      expect(ADMIN_LEVEL_LABELS[level], `level ${level}`).toBeTruthy()
    }
  })
})

// ── Terrain, with the provider stubbed ──────────────────────────────────────
// The module-wide walk in spatial-modules.test.js exercises the no-data path
// (every provider returns null in tests). These cover the path that only runs
// when real terrain comes back.

vi.mock('../src/features/spatial/providers.js', async (importOriginal) => ({
  ...(await importOriginal()),
  elevation: vi.fn(),
}))

const { elevation } = await import('../src/features/spatial/providers.js')
const terrain = (await import('../src/features/spatial/modules/terrain.module.js')).default

const LOW_GROUND = {
  elevationM: 6, minAroundM: 8, maxAroundM: 14, reliefM: 6, relativeM: -4.2, sampleCount: 9,
}

describe('terrain module', () => {
  it('emits provenance on every fact, and never MEASURED for a computed comparison', async () => {
    elevation.mockResolvedValue(LOW_GROUND)
    const result = await terrain.compute({ lat: 13.0, lng: 80.2, propertyType: 'APARTMENT' })

    expect(result.facts.length).toBeGreaterThan(0)
    for (const f of result.facts) {
      expect(Object.values(PROVENANCE)).toContain(f.provenance)
      if (f.provenance === PROVENANCE.ESTIMATED) expect(f.method).toBeTruthy()
    }

    // The raw reading is an observation; the comparison against neighbours is
    // arithmetic over observations. Conflating the two is the contract breach
    // the accuracy pass fixed for distances.
    expect(result.facts.find((f) => f.key === 'elevation').provenance).toBe(PROVENANCE.MEASURED)
    expect(result.facts.find((f) => f.key === 'relative_height').provenance).toBe(PROVENANCE.DERIVED)
  })

  it('never claims flood risk, and says why', async () => {
    elevation.mockResolvedValue(LOW_GROUND)
    const result = await terrain.compute({ lat: 13.0, lng: 80.2, propertyType: 'APARTMENT' })

    const prose = [result.assessment.label, result.assessment.detail, ...result.facts.map((f) => f.display)]
      .join(' ').toLowerCase()
    expect(prose).not.toContain('flood risk')

    expect(result.missing.join(' ')).toMatch(/not flood risk/i)
  })

  it('frames the same reading differently per property type', async () => {
    elevation.mockResolvedValue(LOW_GROUND)

    const forFlat = await terrain.compute({ lat: 13, lng: 80.2, propertyType: 'APARTMENT' })
    const forPlot = await terrain.compute({ lat: 13, lng: 80.2, propertyType: 'LAND' })
    const forShop = await terrain.compute({ lat: 13, lng: 80.2, propertyType: 'COMMERCIAL' })

    // Same ground, same numbers.
    expect(forFlat.facts.find((f) => f.key === 'elevation').value)
      .toBe(forPlot.facts.find((f) => f.key === 'elevation').value)

    // Different consequence — a plot hears about levelling, a shop about stock.
    expect(forPlot.assessment.detail).toMatch(/levelling/i)
    expect(forShop.assessment.detail).toMatch(/stock|waterlogging/i)
    expect(forFlat.assessment.detail).not.toMatch(/levelling/i)
  })

  it('keeps the absolute height when the surrounding ring could not be read', async () => {
    elevation.mockResolvedValue({
      elevationM: 12, minAroundM: null, maxAroundM: null, reliefM: null, relativeM: null, sampleCount: 1,
    })
    const result = await terrain.compute({ lat: 13, lng: 80.2, propertyType: 'HOUSE' })

    expect(result.facts.map((f) => f.key)).toEqual(['elevation'])
    // The ring input must not be claimed — that is what keeps confidence honest.
    expect(result.inputsPresent).toEqual(['srtm_elevation'])
  })

  it('reports nothing rather than sea level when elevation is unavailable', async () => {
    elevation.mockResolvedValue(null)
    const result = await terrain.compute({ lat: 13, lng: 80.2, propertyType: 'HOUSE' })

    expect(result.facts).toEqual([])
    expect(result.inputsPresent).toEqual([])
  })
})
