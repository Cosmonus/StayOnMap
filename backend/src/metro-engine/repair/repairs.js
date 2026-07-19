// Deterministic, pure repair functions. Every one returns its result plus a
// change list — a repair that can't say what it did doesn't run. Deliberately
// absent: anything that moves, snaps, or invents coordinates; geometry only
// ever gets removed, reordered, or merged, never fabricated.
import {
  haversineMeters,
  projectPointOntoPath,
  splitPathIntoComponents,
  PATH_GAP_METERS,
  DUPLICATE_POINT_METERS,
} from '../../lib/metro-validation/index.js'
import { MIN_FRAGMENT_METERS, TRACK_PROXIMITY_METERS, VARIANT_COVERAGE_SAME } from '../constants.js'

export function dedupeConsecutivePoints(path, epsilonMeters = DUPLICATE_POINT_METERS) {
  if (path.length < 2) return { path, removedCount: 0 }
  const out = [path[0]]
  for (let i = 1; i < path.length; i++) {
    if (haversineMeters(out[out.length - 1], path[i]) > epsilonMeters) out.push(path[i])
  }
  return { path: out, removedCount: path.length - out.length }
}

function componentLengthMeters(component) {
  let total = 0
  for (let i = 1; i < component.length; i++) total += haversineMeters(component[i - 1], component[i])
  return total
}

// Gap-separated components shorter than minLengthMeters are stray stubs
// (depot spurs, tagging noise) — dropping them loses no passenger-visible
// track. Interior points are never touched.
export function dropTinyFragments(path, { gapMeters = PATH_GAP_METERS, minLengthMeters = MIN_FRAGMENT_METERS } = {}) {
  const components = splitPathIntoComponents(path, gapMeters)
  if (components.length < 2) return { path, dropped: [] }
  const kept = []
  const dropped = []
  for (const component of components) {
    const lengthMeters = componentLengthMeters(component)
    if (component.length < 2 || lengthMeters < minLengthMeters) {
      dropped.push({ points: component.length, lengthMeters: Math.round(lengthMeters) })
    } else {
      kept.push(component)
    }
  }
  if (!dropped.length) return { path, dropped }
  return { path: kept.flat(), dropped }
}

// Greedy nearest-endpoint reordering of gap-separated components (with
// orientation flips) so multi-segment lines render in travel order — the
// permanent version of roadmap Addendum 4's one-off fix. Starts from the
// first component for run-to-run determinism.
export function orderComponents(path, gapMeters = PATH_GAP_METERS) {
  const components = splitPathIntoComponents(path, gapMeters)
  if (components.length < 2) return { path, reordered: false }

  const remaining = components.slice(1)
  const ordered = [components[0]]
  while (remaining.length) {
    const tail = ordered[ordered.length - 1].at(-1)
    let bestIndex = 0
    let bestFlip = false
    let bestDistance = Infinity
    remaining.forEach((component, i) => {
      const dStart = haversineMeters(tail, component[0])
      const dEnd = haversineMeters(tail, component.at(-1))
      if (dStart < bestDistance) { bestDistance = dStart; bestIndex = i; bestFlip = false }
      if (dEnd < bestDistance) { bestDistance = dEnd; bestIndex = i; bestFlip = true }
    })
    const [next] = remaining.splice(bestIndex, 1)
    ordered.push(bestFlip ? [...next].reverse() : next)
  }

  const result = ordered.flat()
  const reordered = JSON.stringify(result) !== JSON.stringify(path)
  return { path: result, reordered }
}

// OSM `colour` values arrive as CSS names ("blue"), short hex ("0f0"), or
// full hex in any casing. Canonical form: lowercase #rrggbb. Unrecognized
// values pass through unchanged (logged by the caller) — never guessed.
const CSS_COLORS = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  violet: '#ee82ee', pink: '#ffc0cb', brown: '#a52a2a', gray: '#808080',
  grey: '#808080', cyan: '#00ffff', magenta: '#ff00ff', silver: '#c0c0c0',
  gold: '#ffd700', maroon: '#800000', navy: '#000080', olive: '#808000',
  teal: '#008080', aqua: '#00ffff', lime: '#00ff00', indigo: '#4b0082',
  crimson: '#dc143c', orchid: '#da70d6', turquoise: '#40e0d0',
}

export function normalizeColor(color) {
  if (!color) return { color: null, changed: false, recognized: false }
  const raw = String(color).trim()
  const named = CSS_COLORS[raw.toLowerCase()]
  if (named) return { color: named, changed: named !== raw, recognized: true }
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const full = `#${[...hex].map((c) => c + c).join('')}`.toLowerCase()
    return { color: full, changed: true, recognized: true }
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const full = `#${hex}`.toLowerCase()
    return { color: full, changed: full !== raw, recognized: true }
  }
  return { color: raw, changed: false, recognized: false }
}

const pathCoverage = (shorter, longer) => {
  if (!shorter.length || longer.length < 2) return 0
  let covered = 0
  for (const point of shorter) {
    if (projectPointOntoPath(point, longer).distanceMeters <= TRACK_PROXIMITY_METERS) covered++
  }
  return covered / shorter.length
}

// Safety net behind the parser's per-master merge: orphan route relations
// (no route_master) that duplicate another line's corridor — the original
// "two Blue Lines" bug, and direction pairs OSM never grouped. Two lines
// merge only when BOTH hold:
//   - their undecorated base names match ("Delhi–Meerut RRTS (A → B)" and
//     "Delhi–Meerut RRTS (B → A)") — geometry alone is NOT enough, because a
//     through-service legitimately covers another line's whole corridor
//     (Ahmedabad's Yellow Line runs through over the Red Line's track; they
//     are still two lines on every map), and
//   - the shorter's geometry lies almost entirely within track-proximity of
//     the longer's.
// Returns an old-index → new-index map so station line references can follow.
export function mergeDuplicateLines(lines) {
  const groups = lines.map((line, i) => ({
    keeper: line,
    keeperIndex: i,
    memberIndices: [i],
    lengthMeters: componentLengthMeters(line.path),
  }))

  let mergedSomething = true
  const merged = []
  while (mergedSomething && groups.length > 1) {
    mergedSomething = false
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const [a, b] = [groups[i], groups[j]]
        if (stripDecoration(a.keeper.name).toLowerCase() !== stripDecoration(b.keeper.name).toLowerCase()) continue
        // Strict < so an equal-length pair keeps the earlier-indexed line —
        // deterministic keeper choice for direction pairs of identical length.
        const [shorter, longer] = a.lengthMeters < b.lengthMeters ? [a, b] : [b, a]
        if (pathCoverage(shorter.keeper.path, longer.keeper.path) >= VARIANT_COVERAGE_SAME) {
          merged.push({ kept: longer.keeper.name, removed: shorter.keeper.name })
          longer.memberIndices.push(...shorter.memberIndices)
          longer.keeper = {
            ...longer.keeper,
            variantRelationIds: [...new Set([
              ...(longer.keeper.variantRelationIds ?? []),
              ...(shorter.keeper.variantRelationIds ?? []),
            ])].sort((x, y) => x - y),
          }
          groups.splice(groups.indexOf(shorter), 1)
          mergedSomething = true
          break outer
        }
      }
    }
  }

  // Final order: keepers in their original relative order.
  groups.sort((a, b) => a.keeperIndex - b.keeperIndex)
  const indexMap = new Map()
  groups.forEach((group, newIndex) => {
    for (const oldIndex of group.memberIndices) indexMap.set(oldIndex, newIndex)
  })
  return { lines: groups.map((g) => g.keeper), indexMap, merged }
}

export function reindexStationLines(stations, indexMap) {
  return stations.map((station) => ({
    ...station,
    lines: [...new Set((station.lines ?? []).map((i) => indexMap.get(i)).filter((i) => i !== undefined))]
      .sort((a, b) => a - b),
  }))
}

// OSM route names carry directional decorations ("Blue Line: A → B",
// "Red Line (X ⇔ Y)"). When the undecorated name is unique within the city,
// use it; when two lines share a base name (a trunk and its branch, or two
// systems both called "Line 1"), every one keeps its full decorated name —
// dropping the decoration there would either collide or lose which is which.
// The parenthetical form tolerates one level of nested parens — real OSM
// names like "Purple Line (Whitefield (Kadugodi) ⇔ Challaghatta)" nest them.
const PAREN_CONTENT = String.raw`(?:[^()]|\([^()]*\))*`
const DIRECTION_DECORATION = new RegExp(`(\\s*:\\s*[^:]*(→|⇔|↔|->|=>)[^:]*|\\s*\\(${PAREN_CONTENT}(→|⇔|↔|->|=>)${PAREN_CONTENT}\\))\\s*$`)
const stripDecoration = (name) => (name ?? '').replace(DIRECTION_DECORATION, '').trim()

export function normalizeLineNames(lines) {
  const byBase = new Map()
  for (const line of lines) {
    const base = stripDecoration(line.name)
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base).push(line)
  }
  const renamed = []
  const result = lines.map((line) => {
    const base = stripDecoration(line.name)
    if (base && base !== line.name && byBase.get(base).length === 1) {
      renamed.push({ from: line.name, to: base })
      return { ...line, name: base }
    }
    return line
  })
  return { lines: result, renamed }
}

// Curation renames — human facts applied as data. Lines matched by
// osmRelationId, stations by osmNodeId; each application is reported with
// its ruleId so meta.curationApplied stays complete.
export function applyCurationRenames(network, rules) {
  const applied = []
  const lines = network.lines.map((line) => {
    const rule = rules.renameLines.find((r) => r.osmRelationId === line.osmRelationId)
    if (!rule || line.name === rule.to) return line
    applied.push({ ruleId: rule.ruleId, from: line.name, to: rule.to })
    return { ...line, name: rule.to }
  })
  const stations = network.stations.map((station) => {
    const rule = rules.renameStations.find((r) => station.osmNodeIds?.includes(r.osmNodeId))
    if (!rule || station.name === rule.to) return station
    applied.push({ ruleId: rule.ruleId, from: station.name, to: rule.to })
    return { ...station, name: rule.to }
  })
  return { network: { ...network, lines, stations }, applied }
}
