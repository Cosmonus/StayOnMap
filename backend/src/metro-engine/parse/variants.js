// Group route relations under their route_master and merge directional
// variants — the fix for the original duplicate-lines bug. OSM models one
// relation per direction ("Blue Line: A → B" and "Blue Line: B → A") grouped
// by a route_master; the old ingest imported each direction as its own line.
//
// Merge rule (see constants.js): same-track detection is geometric, because
// double-tracked metros map each direction on its own parallel way — way-id
// overlap between directions is often ZERO. Two variants merge when either
// their way sets genuinely overlap (single-track fast path) or the shorter
// variant's geometry lies almost entirely within track-proximity of the
// longer's. A genuine branch (Delhi's Blue Line main vs "Yamuna Bank →
// Vaishali") diverges by kilometres and stays a separate line sharing the
// master's identity.
import { haversineMeters, projectPointOntoPath } from '../../lib/metro-validation/index.js'
import { VARIANT_WAY_JACCARD_SAME, VARIANT_COVERAGE_SAME, TRACK_PROXIMITY_METERS } from '../constants.js'

// chainedRoutes: [{ relation, components, wayIds:Set, stopRefs:[] }]
export function groupByMaster(chainedRoutes, masters) {
  const masterOf = new Map()
  for (const master of masters) {
    for (const member of master.members) {
      if (member.type === 'relation') masterOf.set(member.ref, master)
    }
  }

  const groups = new Map() // master.id | `orphan:${relation.id}` → { master, variants }
  for (const route of chainedRoutes) {
    const master = masterOf.get(route.relation.id) ?? null
    const key = master ? `master:${master.id}` : `orphan:${route.relation.id}`
    if (!groups.has(key)) groups.set(key, { master, variants: [] })
    groups.get(key).variants.push(route)
  }
  return [...groups.values()]
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const id of a) if (b.has(id)) intersection++
  return intersection / (a.size + b.size - intersection)
}

function pathLengthMeters(components) {
  let total = 0
  for (const component of components) {
    for (let i = 1; i < component.length; i++) total += haversineMeters(component[i - 1], component[i])
  }
  return total
}

// Fraction of the shorter cluster's points within TRACK_PROXIMITY_METERS of
// the longer's path. O(n·m) point-to-path projections, but variant paths are
// a few hundred points — fine at parse time.
function coverage(a, b) {
  const [shorter, longer] = a.lengthMeters <= b.lengthMeters ? [a, b] : [b, a]
  const longerPath = longer.keeper.components.flat()
  const points = shorter.keeper.components.flat()
  if (!points.length || longerPath.length < 2) return 0
  let covered = 0
  for (const point of points) {
    if (projectPointOntoPath(point, longerPath).distanceMeters <= TRACK_PROXIMITY_METERS) covered++
  }
  return covered / points.length
}

const sameLine = (a, b) =>
  jaccard(a.wayIds, b.wayIds) >= VARIANT_WAY_JACCARD_SAME || coverage(a, b) >= VARIANT_COVERAGE_SAME

// Greedy clustering so 3+ variants (two directions plus a short-turn service)
// still collapse into one line: repeatedly merge same-line pairs, unioning
// ways/stops and keeping the longer geometry.
function clusterVariants(variants) {
  const clusters = variants.map((v) => ({
    keeper: v,
    lengthMeters: pathLengthMeters(v.components),
    wayIds: new Set(v.wayIds),
    stopRefs: [...v.stopRefs],
    relationIds: [v.relation.id],
  }))

  let merged = true
  while (merged && clusters.length > 1) {
    merged = false
    let best = null
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (sameLine(clusters[i], clusters[j]) && !best) {
          best = { i, j }
        }
      }
    }
    if (best) {
      const [a, b] = [clusters[best.i], clusters[best.j]]
      const [longer, shorter] = a.lengthMeters >= b.lengthMeters ? [a, b] : [b, a]
      for (const id of shorter.wayIds) longer.wayIds.add(id)
      longer.stopRefs.push(...shorter.stopRefs)
      longer.relationIds.push(...shorter.relationIds)
      clusters.splice(best.j, 1)
      if (best.i > best.j) clusters.splice(best.i - 1, 1)
      else clusters.splice(best.i, 1)
      clusters.push(longer)
      merged = true
    }
  }
  return clusters
}

// Directional names carry a ": A → B" suffix; the line itself doesn't.
const stripDirection = (name) => (name ?? '').replace(/\s*:\s*[^:]*(→|->|=>)[^:]*$/, '').trim()

// One group → one or more canonical lines.
export function mergeVariants({ master, variants }) {
  const clusters = clusterVariants(variants)

  return clusters.map((cluster) => {
    const relation = cluster.keeper.relation
    const isSoleLine = clusters.length === 1
    // Sole line under a master: the master's plain name ("Blue Line").
    // Genuine branches keep their variant's own name so the branch is
    // distinguishable — matching how the shipped data already names Delhi's
    // "Blue Line: Yamuna Bank → Vaishali".
    // Same English-first rule as stations: prefer name:en when mapped.
    const masterName = master?.tags?.['name:en'] ?? master?.tags?.name
    const relationName = relation.tags?.['name:en'] ?? relation.tags?.name
    const stripped = stripDirection(relationName)
    const name = isSoleLine
      ? (masterName ?? (stripped || relationName))
      : (relationName ?? stripDirection(masterName))
    return {
      name,
      color: master?.tags?.colour ?? relation.tags?.colour ?? null,
      // Components in relation order, concatenated — downstream gap logic
      // (validator warnings, render-time splitting) handles any real break.
      path: cluster.keeper.components.flat(),
      osmRelationId: relation.id,
      osmRouteMasterId: master?.id ?? null,
      variantRelationIds: [...cluster.relationIds].sort((a, b) => a - b),
      stopRefs: cluster.stopRefs,
      chainLog: cluster.keeper.log,
    }
  })
}
