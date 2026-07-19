// Stations from relation membership — the fix for proximity-derived
// station↔line association. A PT v2 route relation lists its stop_position
// nodes with role `stop` in travel order; that membership IS the answer the
// old ingest approximated with a 400m distance match.
//
// Two things still need geometry:
//   - pre-PT-v2 relations with no role-tagged stops fall back to matching the
//     route's own member nodes that look like stations against the line path
//     (logged loudly — the qa report surfaces which lines needed it)
//   - each direction of a line has its own stop_position nodes (opposite
//     platforms), so the city-wide merge collapses same-named nodes within
//     INTERCHANGE_MATCH_METERS into one station; 2+ distinct lines there is a
//     genuine interchange. Coordinates always come from a real OSM node,
//     never a computed centroid.
import { projectPointOntoPath, haversineMeters, INTERCHANGE_MATCH_METERS } from '../../lib/metro-validation/index.js'

const STOP_ROLES = new Set(['stop', 'stop_entry_only', 'stop_exit_only'])

const looksLikeStation = (tags = {}) =>
  tags.public_transport === 'stop_position' ||
  tags.public_transport === 'station' ||
  tags.railway === 'station' ||
  tags.railway === 'stop' ||
  tags.railway === 'halt'

// One route relation → ordered stop node refs. Role-based first; geometric
// fallback only when the relation has zero role-tagged stops.
export function extractStopRefs(relation, path, nodesById) {
  const roleRefs = relation.members
    .filter((m) => m.type === 'node' && STOP_ROLES.has(m.role))
    .map((m) => m.ref)
  if (roleRefs.length) return { refs: roleRefs, method: 'relation-roles' }

  const fallbackRefs = relation.members
    .filter((m) => m.type === 'node')
    .map((m) => m.ref)
    .filter((ref) => {
      const node = nodesById.get(ref)
      if (!node || !looksLikeStation(node.tags)) return false
      return projectPointOntoPath([node.lat, node.lon], path).distanceMeters <= INTERCHANGE_MATCH_METERS
    })
  return { refs: fallbackRefs, method: fallbackRefs.length ? 'proximity-fallback' : 'none' }
}

const normalizeName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ')

// Mappers often name an interchange's per-line stop nodes with a line suffix
// ("Noapara (Blue Line)" / "Noapara (Yellow Line)"), or a direction pair's
// platforms with a bound suffix ("Western Express Highway (eastbound)").
// Those suffixes describe the platform, not the station — strip them so the
// nodes merge into one entry. The 400m proximity requirement still guards
// against collapsing genuinely different places.
const stripLineSuffix = (name) =>
  name
    .replace(/\s*\([^()]*line\s*\)\s*$/i, '')
    .replace(/\s*\(\s*(east|west|north|south)bound\s*\)\s*$/i, '')
    .trim() || name

// lines: canonical lines (post variant-merge), each carrying stopRefs.
// renameRules: curation renameStations entries — applied to the raw node
// name BEFORE the merge, so a rename that fixes an OSM typo lets the two
// spellings of one station collapse into a single entry.
// Returns the city's station list in shipped schema (+ additive osm ids),
// sorted by name for deterministic output.
export function buildStations(lines, nodesById, renameRules = []) {
  const renameByNodeId = new Map(renameRules.map((r) => [r.osmNodeId, r.to]))
  const merged = [] // { name, lat, lng, lines:Set, osmNodeIds:[] }
  let unnamed = 0

  lines.forEach((line, lineIndex) => {
    for (const ref of line.stopRefs) {
      const node = nodesById.get(ref)
      if (!node) continue
      // The app's UI language is English: prefer name:en where a mapper
      // recorded one (Chennai's `name` tags are Tamil script, for example),
      // falling back to the local-language name rather than dropping the stop.
      const rawName = renameByNodeId.get(node.id) ?? node.tags?.['name:en'] ?? node.tags?.name
      // A nameless stop_position can't be rendered or referenced; count it
      // rather than invent a label.
      if (!rawName) { unnamed++; continue }
      const name = stripLineSuffix(rawName)

      const existing = merged.find(
        (s) => normalizeName(s.name) === normalizeName(name) &&
          haversineMeters([s.lat, s.lng], [node.lat, node.lon]) <= INTERCHANGE_MATCH_METERS
      )
      if (existing) {
        existing.lines.add(lineIndex)
        if (!existing.osmNodeIds.includes(node.id)) existing.osmNodeIds.push(node.id)
      } else {
        // First-encountered node (lowest line index) supplies the coordinate —
        // deterministic, and always a real OSM point.
        merged.push({ name, lat: node.lat, lng: node.lon, lines: new Set([lineIndex]), osmNodeIds: [node.id] })
      }
    }
  })

  const stations = merged
    .map((s) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      lines: [...s.lines].sort((a, b) => a - b),
      osmNodeId: s.osmNodeIds[0],
      osmNodeIds: s.osmNodeIds,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  return { stations, unnamedStopCount: unnamed }
}
