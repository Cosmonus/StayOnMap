/**
 * Metro network validation tests
 *
 * What each suite guards against:
 *   ERROR rules       — duplicate line/station names, out-of-range station.lines
 *                        indices, invalid/out-of-bounds coordinates, empty/
 *                        degenerate paths — all unambiguous, never baseline-eligible
 *   WARNING rules      — geometric judgment calls (gaps, unmapped stations,
 *                        self-intersection, termini, interchange consistency,
 *                        color format, duplicate edges) — baseline-eligible
 *   baseline diff      — a warning absent from the baseline is "new" (fails);
 *                        present is "known" (informational); a baseline entry
 *                        with no matching current warning is "resolved"
 *   real data          — all 9 shipped city files pass with zero errors and
 *                        zero new (un-baselined) warnings against the
 *                        checked-in baseline
 *   structural snapshot — per-city line/station counts match expectations;
 *                        a silently-deleted station would be caught
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { validateNetwork, buildHealthReport } from '../src/lib/metro-validation/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../src/data/metro-lines')
const BASELINE_PATH = path.join(__dirname, '../data/metro-validation-baseline.json')

// ─── helpers ────────────────────────────────────────────────────────────────

function makeStation(overrides = {}) {
  return { name: 'Station A', lat: 12.9716, lng: 77.5946, lines: [0], ...overrides }
}

function makeLine(overrides = {}) {
  return {
    name: 'Test Line',
    color: '#0284C7',
    path: [[12.9700, 77.5900], [12.9716, 77.5946], [12.9730, 77.6000]],
    ...overrides,
  }
}

function makeCityData(overrides = {}) {
  return {
    city: 'TestCity',
    lines: [makeLine()],
    stations: [makeStation()],
    ...overrides,
  }
}

function loadRealCitiesData() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(DATA_DIR, f), 'utf-8')))
}

// ─── checkDuplicateLineNames ────────────────────────────────────────────────

describe('checkDuplicateLineNames', () => {
  it('flags two lines sharing a name (case-insensitive) as an error', () => {
    const city = makeCityData({ lines: [makeLine({ name: 'Blue Line' }), makeLine({ name: 'blue line' })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'duplicate-line-name')).toBe(true)
  })

  it('does not flag two lines with distinct names', () => {
    const city = makeCityData({ lines: [makeLine({ name: 'Blue Line' }), makeLine({ name: 'Red Line' })] })
    const { errors } = validateNetwork(city)
    expect(errors.filter((e) => e.code === 'duplicate-line-name')).toHaveLength(0)
  })
})

// ─── checkDuplicateStationNames ─────────────────────────────────────────────

describe('checkDuplicateStationNames', () => {
  it('flags two stations sharing a name as an error', () => {
    const city = makeCityData({ stations: [makeStation({ name: 'Central' }), makeStation({ name: 'Central' })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'duplicate-station-name')).toBe(true)
  })
})

// ─── checkStationLineIndexRange ─────────────────────────────────────────────

describe('checkStationLineIndexRange', () => {
  it('flags a station referencing an out-of-range line index', () => {
    const city = makeCityData({ stations: [makeStation({ lines: [5] })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'station-line-index-out-of-range')).toBe(true)
  })

  it('does not flag a station referencing a valid line index', () => {
    const city = makeCityData({ stations: [makeStation({ lines: [0] })] })
    const { errors } = validateNetwork(city)
    expect(errors.filter((e) => e.code === 'station-line-index-out-of-range')).toHaveLength(0)
  })
})

// ─── checkCoordinateBoundsAndValidity ───────────────────────────────────────

describe('checkCoordinateBoundsAndValidity', () => {
  it('flags a station outside India\'s bounding box', () => {
    const city = makeCityData({ stations: [makeStation({ lat: 51.5, lng: -0.1 })] }) // London
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'station-coordinate-out-of-bounds')).toBe(true)
  })

  it('flags a station with a NaN coordinate', () => {
    const city = makeCityData({ stations: [makeStation({ lat: NaN })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'invalid-station-coordinate')).toBe(true)
  })
})

// ─── checkEmptyPath ─────────────────────────────────────────────────────────

describe('checkEmptyPath', () => {
  it('flags a line with fewer than 2 path points', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59]] })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'empty-line-path')).toBe(true)
  })
})

// ─── checkExactDuplicateConsecutivePathPoints ───────────────────────────────

describe('checkExactDuplicateConsecutivePathPoints', () => {
  it('flags two identical consecutive path points', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59], [12.97, 77.59], [12.98, 77.60]] })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'duplicate-consecutive-path-point')).toBe(true)
  })
})

// ─── checkSelfLoopingPath ───────────────────────────────────────────────────

describe('checkSelfLoopingPath', () => {
  it('flags a path whose start and end point are (nearly) identical', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59], [12.98, 77.60], [12.97, 77.59]] })] })
    const { errors } = validateNetwork(city)
    expect(errors.some((e) => e.code === 'accidental-self-loop')).toBe(true)
  })
})

// ─── checkResidualPathGapsAndBranches ───────────────────────────────────────

describe('checkResidualPathGapsAndBranches', () => {
  it('flags a >2km gap between consecutive path points as a residual gap', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59], [13.05, 77.59]] })] }) // ~9km apart
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'residual-path-gap' || w.code === 'possible-unmodeled-branch')).toBe(true)
  })

  it('flags an unusually large (>5km) gap as a possible unmodeled branch instead', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59], [13.15, 77.59]] })] }) // ~20km apart
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'possible-unmodeled-branch')).toBe(true)
  })
})

// ─── checkUnmappedStations ──────────────────────────────────────────────────

describe('checkUnmappedStations', () => {
  it('flags a station with no claimed lines that is far from every line', () => {
    const city = makeCityData({ stations: [makeStation({ lines: [], lat: 20, lng: 80 })] })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'unmapped-station')).toBe(true)
  })

  it('exempts Surat from unmapped-station warnings (metro not built yet)', () => {
    const city = makeCityData({ city: 'Surat', lines: [], stations: [makeStation({ lines: [], lat: 20, lng: 80 })] })
    const { warnings } = validateNetwork(city)
    expect(warnings.filter((w) => w.code === 'unmapped-station')).toHaveLength(0)
  })
})

// ─── checkInterchangeConsistency ────────────────────────────────────────────

describe('checkInterchangeConsistency', () => {
  it('flags a station claiming to be an interchange on a line it is nowhere near', () => {
    const farLine = makeLine({ name: 'Far Line', path: [[20, 80], [20.1, 80.1]] })
    const city = makeCityData({
      lines: [makeLine(), farLine],
      stations: [makeStation({ lines: [0, 1] })], // claims both, but only near line 0
    })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'broken-interchange')).toBe(true)
  })
})

// ─── checkMultipleComponentsPerLine ─────────────────────────────────────────

describe('checkMultipleComponentsPerLine', () => {
  it('flags a line whose path splits into multiple components after the gap tolerance', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[12.97, 77.59], [13.05, 77.59]] })] })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'disconnected-line-components')).toBe(true)
  })
})

// ─── checkSelfIntersectingGeometry ──────────────────────────────────────────

describe('checkSelfIntersectingGeometry', () => {
  it('flags a bowtie-shaped path (the two diagonals of a square) that crosses itself', () => {
    // Padding points before/after the crossing shape so it doesn't land on
    // the (i===0, j===lastSegment) "adjacent-at-wrap" exemption.
    const city = makeCityData({
      lines: [makeLine({ path: [[-0.01, -0.01], [0, 0], [0.02, 0.02], [0, 0.02], [0.02, 0], [0.03, 0.03]] })],
    })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'self-intersecting-geometry')).toBe(true)
  })

  it('does not flag a simple, non-crossing path', () => {
    const city = makeCityData({ lines: [makeLine({ path: [[0, 0], [0, 1], [0, 2]] })] })
    const { warnings } = validateNetwork(city)
    expect(warnings.filter((w) => w.code === 'self-intersecting-geometry')).toHaveLength(0)
  })
})

// ─── checkUnexpectedTermination ─────────────────────────────────────────────

describe('checkUnexpectedTermination', () => {
  it('flags a line whose start point has no station nearby', () => {
    const city = makeCityData({
      lines: [makeLine({ path: [[5, 5], [12.97, 77.59]] })],
      stations: [makeStation({ lat: 12.97, lng: 77.59 })], // only near the end
    })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'unexpected-termination')).toBe(true)
  })
})

// ─── checkColorFormatConsistency ────────────────────────────────────────────

describe('checkColorFormatConsistency', () => {
  it('flags a line with no color set', () => {
    const city = makeCityData({ lines: [makeLine({ color: null })] })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'missing-line-color')).toBe(true)
  })
})

// ─── checkDuplicateEdges ─────────────────────────────────────────────────────

describe('checkDuplicateEdges', () => {
  it('flags the same segment repeated at non-adjacent path indices', () => {
    const city = makeCityData({
      lines: [makeLine({ path: [[0, 0], [0, 1], [1, 1], [0, 0], [0, 1]] })],
    })
    const { warnings } = validateNetwork(city)
    expect(warnings.some((w) => w.code === 'duplicate-edge')).toBe(true)
  })
})

// ─── baseline diff (buildHealthReport) ──────────────────────────────────────

describe('buildHealthReport baseline diff', () => {
  it('treats a warning as new when absent from the baseline, and known when present', () => {
    // Stations at both of the default line's own path endpoints keep its
    // termini satisfied (so the only warning triggered is the unmapped one
    // we're isolating below), plus the genuinely-unmapped station.
    const line = makeLine()
    const city = makeCityData({
      lines: [line],
      stations: [
        makeStation({ name: 'Start Station', lat: line.path[0][0], lng: line.path[0][1] }),
        makeStation({ name: 'End Station', lat: line.path.at(-1)[0], lng: line.path.at(-1)[1] }),
        makeStation({ name: 'Station B', lines: [], lat: 20, lng: 80 }),
      ],
    })

    const emptyReport = buildHealthReport([city], { entries: [] })
    const found = emptyReport.newWarnings.find((w) => w.code === 'unmapped-station')
    expect(found).toBeTruthy()
    expect(emptyReport.knownWarnings).toHaveLength(0)

    const filledBaseline = { entries: [{ code: found.code, city: found.city, station: found.station }] }
    const filledReport = buildHealthReport([city], filledBaseline)
    expect(filledReport.knownWarnings.some((w) => w.code === 'unmapped-station')).toBe(true)
    expect(filledReport.newWarnings).toHaveLength(0)
  })

  it('reports a resolved baseline entry when a previously-known warning no longer reproduces', () => {
    const city = makeCityData() // triggers no warnings at all
    const staleBaseline = { entries: [{ code: 'unmapped-station', city: 'TestCity', station: 'Ghost Station' }] }
    const report = buildHealthReport([city], staleBaseline)
    expect(report.resolvedBaselineEntries).toHaveLength(1)
  })

  it('never lets an error be absorbed by the baseline', () => {
    const city = makeCityData({ lines: [makeLine({ name: 'X' }), makeLine({ name: 'X' })] })
    const baselineWithError = { entries: [{ code: 'duplicate-line-name', city: 'TestCity', line: 'X' }] }
    const report = buildHealthReport([city], baselineWithError)
    expect(report.errors.some((e) => e.code === 'duplicate-line-name')).toBe(true)
  })
})

// ─── real data regression ───────────────────────────────────────────────────

describe('real data regression', () => {
  it('all shipped city files pass with zero errors and zero new warnings against the checked-in baseline', () => {
    const citiesData = loadRealCitiesData()
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    const report = buildHealthReport(citiesData, baseline)
    expect(report.errors).toHaveLength(0)
    expect(report.newWarnings).toHaveLength(0)
  })
})

// ─── structural snapshot ────────────────────────────────────────────────────

// Counts live in the committed snapshot file, written only by the metro
// engine's promote/snapshot commands (`node scripts/metro-engine.mjs snapshot
// --confirm`) — a data change without a deliberate snapshot update still
// fails here, but updating no longer means editing test source.
const SNAPSHOT_PATH = path.join(__dirname, '../data/metro-structure-snapshot.json')
const EXPECTED_CITY_COUNTS = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8')).cities

describe('structural snapshot', () => {
  it('matches the snapshot per-city line/station counts exactly — update via `metro-engine.mjs snapshot --confirm` deliberately if this changes', () => {
    const citiesData = loadRealCitiesData()
    for (const cityData of citiesData) {
      const expected = EXPECTED_CITY_COUNTS[cityData.city]
      expect(expected, `no expected count entry for city "${cityData.city}"`).toBeTruthy()
      expect(cityData.lines.length, `${cityData.city} line count`).toBe(expected.lines)
      expect(cityData.stations.length, `${cityData.city} station count`).toBe(expected.stations)
    }
    expect(citiesData).toHaveLength(Object.keys(EXPECTED_CITY_COUNTS).length)
  })

  it('would catch a station silently disappearing from real data', () => {
    const chennai = JSON.parse(readFileSync(path.join(DATA_DIR, 'chennai.json'), 'utf-8'))
    const mutated = { ...chennai, stations: chennai.stations.slice(1) }
    expect(mutated.stations.length).not.toBe(EXPECTED_CITY_COUNTS.Chennai.stations)
  })
})
