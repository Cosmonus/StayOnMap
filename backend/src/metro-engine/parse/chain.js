// Chain a route relation's way members into ordered path components.
//
// This is the fix for the original "teleporting lines" bug: the old ingest
// concatenated way geometries in whatever order Overpass returned them. OSM
// relation members are ordered along the route, but each way's own point
// order is independent of travel direction — so chaining means walking the
// members IN RELATION ORDER and flipping each way to fit the growing chain.
//
// Hard rule: no match on either end of the chain closes the current component
// and starts a new one. Gaps are never bridged with invented geometry — a
// break in OSM stays a visible break (splitPathIntoComponents downstream
// keeps renderers honest about it).
import { haversineMeters } from '../../lib/metro-validation/index.js'
import { WAY_SNAP_METERS } from '../constants.js'

// Roles that are trackside street furniture, not track: platforms must never
// contribute geometry. Empty role = the track itself in PT v2.
const NON_TRACK_ROLES = new Set(['platform', 'platform_entry_only', 'platform_exit_only'])

// Shared OSM nodes serialize bit-identically, so most joins are exact; the
// metre fallback covers ways that meet without literally sharing a node.
const EXACT_EPS_DEG = 1e-6

function joinKind(a, b) {
  if (Math.abs(a[0] - b[0]) < EXACT_EPS_DEG && Math.abs(a[1] - b[1]) < EXACT_EPS_DEG) return 'exact'
  if (haversineMeters(a, b) <= WAY_SNAP_METERS) return 'near'
  return false
}

// geometry: [[lat,lng],...] candidate way; chain: the growing component.
// Tries tail-append (both orientations) then head-prepend (both). On an exact
// join the duplicated shared node is dropped; on a near join every point is
// kept (the 5m dedupe repair cleans any residue).
function tryJoin(chain, geometry) {
  const tail = chain[chain.length - 1]
  const head = chain[0]
  const first = geometry[0]
  const last = geometry[geometry.length - 1]

  let kind
  if ((kind = joinKind(first, tail))) return [...chain, ...geometry.slice(kind === 'exact' ? 1 : 0)]
  if ((kind = joinKind(last, tail))) {
    const reversed = [...geometry].reverse()
    return [...chain, ...reversed.slice(kind === 'exact' ? 1 : 0)]
  }
  if ((kind = joinKind(last, head))) return [...geometry.slice(0, kind === 'exact' ? -1 : undefined), ...chain]
  if ((kind = joinKind(first, head))) {
    const reversed = [...geometry].reverse()
    return [...reversed.slice(0, kind === 'exact' ? -1 : undefined), ...chain]
  }
  return null
}

// wayMembers: relation members of type 'way' (with inline `geometry` from
// `out geom`), already in relation order. Returns ordered components plus a
// log of what the chainer had to do — flips aren't visible in the output, but
// a high break count is the signal a relation's member order is genuinely
// broken in OSM rather than merely unoriented.
export function chainWayMembers(wayMembers) {
  const components = []
  let current = null
  let breaks = 0

  for (const member of wayMembers) {
    if (NON_TRACK_ROLES.has(member.role)) continue
    const geometry = (member.geometry ?? []).map((p) => [p.lat, p.lon])
    if (geometry.length < 2) continue

    if (!current) { current = geometry; continue }
    const joined = tryJoin(current, geometry)
    if (joined) {
      current = joined
    } else {
      components.push(current)
      current = geometry
      breaks++
    }
  }
  if (current) components.push(current)

  return { components, log: { componentCount: components.length, breaks } }
}
