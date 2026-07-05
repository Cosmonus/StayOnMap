// Every validation check for one city's metro network data. Each function
// is `(cityData, ctx) => Issue[]`, pure — no I/O. `ctx.graph` is the
// precomputed per-line derived graph from graph.js's deriveNetworkGraph(),
// shared across rules so it's only computed once per city per run.
//
// An Issue is `{ severity: 'error' | 'warning', code, city, line?, station?,
// message, detail? }`. ERROR issues are never baseline-eligible (see
// report.js) — only put a check here as ERROR if it's unambiguous and
// always a real defect, never a legitimate geometric limitation.

import {
  haversineMeters,
  splitPathIntoComponents,
  segmentsIntersect,
  projectPointOntoPath,
} from './graph.js'
import {
  INDIA_BOUNDS,
  INTERCHANGE_MATCH_METERS,
  UNMAPPED_STATION_METERS,
  PATH_GAP_METERS,
  POSSIBLE_BRANCH_GAP_METERS,
  TERMINUS_MATCH_METERS,
  DUPLICATE_POINT_METERS,
  CITIES_WITH_NO_METRO_YET,
  LOOP_LINE_NAME_HINTS,
} from './constants.js'

function issue(severity, code, city, fields, message, detail) {
  return { severity, code, city, ...fields, message, detail }
}

function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng)
  )
}

function inIndiaBounds(lat, lng) {
  return (
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng
  )
}

// ─── ERROR tier ─────────────────────────────────────────────────────────

export function checkRequiredTopLevelFields(cityData) {
  const issues = []
  const city = cityData?.city ?? '(unknown)'
  if (typeof cityData?.city !== 'string' || !cityData.city) {
    issues.push(issue('error', 'missing-city-field', city, {}, 'City data is missing a valid "city" string field.'))
  }
  if (!Array.isArray(cityData?.lines)) {
    issues.push(issue('error', 'missing-lines-field', city, {}, '"lines" must be an array.'))
    return issues
  }
  if (!Array.isArray(cityData?.stations)) {
    issues.push(issue('error', 'missing-stations-field', city, {}, '"stations" must be an array.'))
    return issues
  }
  cityData.lines.forEach((line, i) => {
    if (typeof line?.name !== 'string' || !line.name) {
      issues.push(issue('error', 'line-missing-name', city, { line: `index ${i}` }, `Line at index ${i} is missing a "name".`))
    }
    if (!Array.isArray(line?.path)) {
      issues.push(issue('error', 'line-missing-path', city, { line: line?.name ?? `index ${i}` }, 'Line is missing a "path" array.'))
    }
  })
  cityData.stations.forEach((station, i) => {
    if (typeof station?.name !== 'string' || !station.name) {
      issues.push(issue('error', 'station-missing-name', city, { station: `index ${i}` }, `Station at index ${i} is missing a "name".`))
    }
  })
  return issues
}

export function checkDuplicateLineNames(cityData) {
  const city = cityData.city
  const seen = new Map()
  const issues = []
  cityData.lines.forEach((line, i) => {
    const key = (line.name ?? '').toLowerCase()
    if (!key) return
    if (seen.has(key)) {
      issues.push(issue(
        'error', 'duplicate-line-name', city, { line: line.name },
        `Two lines share the name "${line.name}" (indices ${seen.get(key)} and ${i}) — this collides with mobile's React key={line.name}.`,
        { indices: [seen.get(key), i] },
      ))
    } else {
      seen.set(key, i)
    }
  })
  return issues
}

export function checkDuplicateStationNames(cityData) {
  const city = cityData.city
  const seen = new Map()
  const issues = []
  cityData.stations.forEach((station, i) => {
    const key = (station.name ?? '').toLowerCase()
    if (!key) return
    if (seen.has(key)) {
      issues.push(issue(
        'error', 'duplicate-station-name', city, { station: station.name },
        `Two stations share the name "${station.name}" (indices ${seen.get(key)} and ${i}) — this collides with every consumer's key={station.name}.`,
        { indices: [seen.get(key), i] },
      ))
    } else {
      seen.set(key, i)
    }
  })
  return issues
}

export function checkStationLineIndexRange(cityData) {
  const city = cityData.city
  const issues = []
  cityData.stations.forEach((station) => {
    for (const i of station.lines ?? []) {
      if (!Number.isInteger(i) || i < 0 || i >= cityData.lines.length) {
        issues.push(issue(
          'error', 'station-line-index-out-of-range', city, { station: station.name },
          `Station "${station.name}" references line index ${i}, which is out of range (0-${cityData.lines.length - 1}).`,
        ))
      }
    }
  })
  return issues
}

export function checkCoordinateBoundsAndValidity(cityData) {
  const city = cityData.city
  const issues = []
  cityData.stations.forEach((station) => {
    if (!isValidCoord(station.lat, station.lng)) {
      issues.push(issue('error', 'invalid-station-coordinate', city, { station: station.name }, `Station "${station.name}" has a missing/NaN/non-numeric coordinate.`))
    } else if (!inIndiaBounds(station.lat, station.lng)) {
      issues.push(issue('error', 'station-coordinate-out-of-bounds', city, { station: station.name }, `Station "${station.name}" (${station.lat}, ${station.lng}) is outside India's bounding box.`))
    }
  })
  cityData.lines.forEach((line) => {
    (line.path ?? []).forEach(([lat, lng], i) => {
      if (!isValidCoord(lat, lng)) {
        issues.push(issue('error', 'invalid-path-coordinate', city, { line: line.name }, `Line "${line.name}" has a missing/NaN/non-numeric coordinate at path index ${i}.`))
      } else if (!inIndiaBounds(lat, lng)) {
        issues.push(issue('error', 'path-coordinate-out-of-bounds', city, { line: line.name }, `Line "${line.name}" has a path point (${lat}, ${lng}) outside India's bounding box at index ${i}.`))
      }
    })
  })
  return issues
}

export function checkEmptyPath(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    if (!Array.isArray(line.path) || line.path.length < 2) {
      issues.push(issue('error', 'empty-line-path', city, { line: line.name }, `Line "${line.name}" has fewer than 2 path points — cannot be a line.`))
    }
  })
  return issues
}

export function checkExactDuplicateConsecutivePathPoints(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    for (let i = 1; i < path.length; i++) {
      if (!isValidCoord(path[i - 1][0], path[i - 1][1]) || !isValidCoord(path[i][0], path[i][1])) continue
      if (haversineMeters(path[i - 1], path[i]) < DUPLICATE_POINT_METERS) {
        issues.push(issue(
          'error', 'duplicate-consecutive-path-point', city, { line: line.name },
          `Line "${line.name}" has a zero-length segment at path index ${i - 1}-${i} (points within ${DUPLICATE_POINT_METERS}m of each other).`,
        ))
      }
    }
  })
  return issues
}

export function checkSelfLoopingPath(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    if (path.length < 2) return
    const name = (line.name ?? '').toLowerCase()
    if (LOOP_LINE_NAME_HINTS.some((hint) => name.includes(hint))) return
    if (!isValidCoord(path[0][0], path[0][1]) || !isValidCoord(path.at(-1)[0], path.at(-1)[1])) return
    if (haversineMeters(path[0], path.at(-1)) < DUPLICATE_POINT_METERS) {
      issues.push(issue('error', 'accidental-self-loop', city, { line: line.name }, `Line "${line.name}" starts and ends at (nearly) the same point — likely an accidental closed loop, not a real circular line.`))
    }
  })
  return issues
}

// ─── WARNING tier (baseline-eligible) ──────────────────────────────────

export function checkResidualPathGapsAndBranches(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    for (let i = 1; i < path.length; i++) {
      if (!isValidCoord(path[i - 1][0], path[i - 1][1]) || !isValidCoord(path[i][0], path[i][1])) continue
      const gap = haversineMeters(path[i - 1], path[i])
      if (gap > POSSIBLE_BRANCH_GAP_METERS) {
        issues.push(issue(
          'warning', 'possible-unmodeled-branch', city, { line: line.name },
          `Line "${line.name}" has an unusually large ${(gap / 1000).toFixed(2)}km gap at path index ${i - 1}-${i} — may indicate an unmodeled Y-branch; consider splitting into two line entries if OSM data confirms a junction. Not asserted as fact.`,
          { gapMeters: gap, index: i },
        ))
      } else if (gap > PATH_GAP_METERS) {
        issues.push(issue(
          'warning', 'residual-path-gap', city, { line: line.name },
          `Line "${line.name}" has a ${(gap / 1000).toFixed(2)}km gap at path index ${i - 1}-${i}.`,
          { gapMeters: gap, index: i },
        ))
      }
    }
  })
  return issues
}

export function checkUnmappedStations(cityData) {
  const city = cityData.city
  const issues = []
  if (CITIES_WITH_NO_METRO_YET.has(city)) return issues
  cityData.stations.forEach((station) => {
    const claimed = station.lines ?? []
    if (claimed.length > 0) return
    if (!isValidCoord(station.lat, station.lng)) return
    let nearestMeters = Infinity
    for (const line of cityData.lines) {
      const { distanceMeters } = projectPointOntoPath([station.lat, station.lng], line.path ?? [])
      if (distanceMeters < nearestMeters) nearestMeters = distanceMeters
    }
    if (nearestMeters > UNMAPPED_STATION_METERS) {
      issues.push(issue(
        'warning', 'unmapped-station', city, { station: station.name },
        `Station "${station.name}" is not within ${UNMAPPED_STATION_METERS}m of any line (nearest: ${(nearestMeters / 1000).toFixed(2)}km).`,
      ))
    }
  })
  return issues
}

export function checkOutOfOrderStationSequence(cityData, ctx) {
  const city = cityData.city
  const issues = []
  for (const { line, nodes } of ctx.graph) {
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1]
      const b = nodes[i]
      const ordinalGap = b.ordinalPosition - a.ordinalPosition
      if (ordinalGap > 0.3) continue // clearly separated along the path, not ambiguous
      const realDistance = haversineMeters([a.station.lat, a.station.lng], [b.station.lat, b.station.lng])
      if (realDistance > 1000) {
        issues.push(issue(
          'warning', 'ambiguous-station-ordering', city, { line: line.name, station: `${a.station.name} / ${b.station.name}` },
          `Stations "${a.station.name}" and "${b.station.name}" on line "${line.name}" project to nearly the same point along the path but are ${(realDistance / 1000).toFixed(2)}km apart in reality — the path may loop back near here. Best-effort signal, not a hard guarantee.`,
        ))
      }
    }
  }
  return issues
}

export function checkInterchangeConsistency(cityData, ctx) {
  const city = cityData.city
  const issues = []
  const graphByLineIndex = new Map(ctx.graph.map((g) => [g.lineIndex, g]))
  cityData.stations.forEach((station) => {
    const claimed = station.lines ?? []
    if (claimed.length < 2) return
    for (const lineIndex of claimed) {
      const lineGraph = graphByLineIndex.get(lineIndex)
      if (!lineGraph) continue
      const node = lineGraph.nodes.find((n) => n.station === station)
      if (!node || node.distanceMeters > INTERCHANGE_MATCH_METERS) {
        issues.push(issue(
          'warning', 'broken-interchange', city, { station: station.name, line: lineGraph.line.name },
          `Station "${station.name}" claims to be an interchange including line "${lineGraph.line.name}", but is ${node ? (node.distanceMeters).toFixed(0) + 'm' : 'not'} within the ${INTERCHANGE_MATCH_METERS}m tight-match threshold for that line.`,
        ))
      }
    }
  })
  return issues
}

export function checkMultipleComponentsPerLine(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const components = splitPathIntoComponents(line.path ?? [], PATH_GAP_METERS)
    if (components.length > 1) {
      issues.push(issue(
        'warning', 'disconnected-line-components', city, { line: line.name },
        `Line "${line.name}" splits into ${components.length} disconnected components after accounting for the ${PATH_GAP_METERS}m gap tolerance.`,
        { componentCount: components.length },
      ))
    }
  })
  return issues
}

const SELF_INTERSECT_CLUSTER_WINDOW = 3

export function checkSelfIntersectingGeometry(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    const pairs = []
    for (let i = 0; i < path.length - 1; i++) {
      for (let j = i + 2; j < path.length - 1; j++) {
        if (i === 0 && j === path.length - 2) continue // adjacent-at-wrap, not a real crossing
        if (segmentsIntersect(path[i], path[i + 1], path[j], path[j + 1])) pairs.push([i, j])
      }
    }
    // A single real crossing between two stretches of path shows up as many
    // adjacent segment-pairs all intersecting near the same physical point
    // — cluster those into one reported "crossing zone" instead of
    // reporting each contributing pair as its own issue.
    const clusters = []
    for (const [i, j] of pairs) {
      const cluster = clusters.find((c) => Math.abs(i - c.iMin) <= SELF_INTERSECT_CLUSTER_WINDOW && Math.abs(j - c.jMin) <= SELF_INTERSECT_CLUSTER_WINDOW)
      if (cluster) {
        cluster.iMin = Math.min(cluster.iMin, i)
        cluster.jMin = Math.min(cluster.jMin, j)
      } else {
        clusters.push({ iMin: i, jMin: j })
      }
    }
    for (const cluster of clusters) {
      issues.push(issue(
        'warning', 'self-intersecting-geometry', city, { line: line.name },
        `Line "${line.name}" crosses itself near segments ${cluster.iMin} and ${cluster.jMin} — may be legitimate out-and-back geometry on a spur/branch line, not necessarily a bug.`,
      ))
    }
  })
  return issues
}

export function checkUnexpectedTermination(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    if (path.length < 2) return
    for (const [label, point] of [['start', path[0]], ['end', path.at(-1)]]) {
      if (!isValidCoord(point[0], point[1])) continue
      let nearestMeters = Infinity
      for (const station of cityData.stations) {
        if (!isValidCoord(station.lat, station.lng)) continue
        const d = haversineMeters(point, [station.lat, station.lng])
        if (d < nearestMeters) nearestMeters = d
      }
      if (nearestMeters > TERMINUS_MATCH_METERS) {
        issues.push(issue(
          'warning', 'unexpected-termination', city, { line: line.name },
          `Line "${line.name}"'s ${label} point has no station within ${TERMINUS_MATCH_METERS}m (nearest: ${(nearestMeters / 1000).toFixed(2)}km).`,
        ))
      }
    }
  })
  return issues
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function checkColorFormatConsistency(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    if (line.color == null) {
      issues.push(issue('warning', 'missing-line-color', city, { line: line.name }, `Line "${line.name}" has no color set.`))
    } else if (!HEX_COLOR.test(line.color) && typeof line.color === 'string' && line.color !== line.color.toLowerCase() && line.color !== line.color.toUpperCase()) {
      // only flag genuinely mixed-case CSS-name-like strings; plain hex/lowercase/uppercase names are fine
      issues.push(issue('warning', 'inconsistent-color-format', city, { line: line.name }, `Line "${line.name}" has an unusually-cased color value "${line.color}".`))
    }
  })
  return issues
}

export function checkDuplicateEdges(cityData) {
  const city = cityData.city
  const issues = []
  cityData.lines.forEach((line) => {
    const path = line.path ?? []
    const seen = new Set()
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      if (!isValidCoord(a[0], a[1]) || !isValidCoord(b[0], b[1])) continue
      const round = (n) => Math.round(n * 1e6) / 1e6
      const keyA = `${round(a[0])},${round(a[1])}`
      const keyB = `${round(b[0])},${round(b[1])}`
      const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`
      if (seen.has(key)) {
        issues.push(issue('warning', 'duplicate-edge', city, { line: line.name }, `Line "${line.name}" repeats the same segment (index ${i}) elsewhere in its path.`))
      } else {
        seen.add(key)
      }
    }
  })
  return issues
}

// checkRequiredTopLevelFields is run separately, first, by index.js's
// validateNetwork() — it gates whether the rest of these (which all assume
// well-formed lines/stations arrays) are safe to run at all.
export const ERROR_RULES = [
  checkDuplicateLineNames,
  checkDuplicateStationNames,
  checkStationLineIndexRange,
  checkCoordinateBoundsAndValidity,
  checkEmptyPath,
  checkExactDuplicateConsecutivePathPoints,
  checkSelfLoopingPath,
]

export const WARNING_RULES = [
  checkResidualPathGapsAndBranches,
  checkUnmappedStations,
  checkOutOfOrderStationSequence,
  checkInterchangeConsistency,
  checkMultipleComponentsPerLine,
  checkSelfIntersectingGeometry,
  checkUnexpectedTermination,
  checkColorFormatConsistency,
  checkDuplicateEdges,
]
