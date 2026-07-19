// Parse orchestrator: raw Overpass envelope + curation → candidate network
// in the shipped schema (plus additive provenance fields) and a parse log.
// Pure with respect to the filesystem — the CLI owns reading/writing.
import { indexElements } from './elements.js'
import { classifyRoute } from './lifecycle.js'
import { chainWayMembers } from './chain.js'
import { groupByMaster, mergeVariants } from './variants.js'
import { extractStopRefs, buildStations } from './stations.js'
import { cityCuration } from '../curation.js'
import { ENGINE_VERSION } from '../constants.js'

export function parseCity(rawEnvelope, curation) {
  const rules = cityCuration(curation, rawEnvelope.city)
  const { nodesById, masters, routes } = indexElements(rawEnvelope.elements)

  const active = []
  const excludedRelations = []
  const curationApplied = new Set()
  for (const route of routes) {
    const verdict = classifyRoute(route, rules)
    if (verdict.status === 'active') {
      active.push(route)
    } else {
      excludedRelations.push({ id: verdict.id, name: verdict.name, reason: verdict.reason })
      const ruleId = /curation (\S+)/.exec(verdict.reason)?.[1]
      if (ruleId) curationApplied.add(ruleId)
    }
  }
  for (const rule of rules.includeRelations) {
    if (routes.some((r) => r.id === rule.id)) curationApplied.add(rule.ruleId)
  }

  // Chain every active variant's ways, then group under masters and merge
  // directions into canonical lines.
  const chained = active.map((relation) => {
    const wayMembers = relation.members.filter((m) => m.type === 'way')
    const { components, log } = chainWayMembers(wayMembers)
    const path = components.flat()
    const { refs, method } = extractStopRefs(relation, path, nodesById)
    return {
      relation,
      components,
      log,
      wayIds: new Set(wayMembers.map((m) => m.ref)),
      stopRefs: refs,
      stationMethod: method,
    }
  })

  const lines = groupByMaster(chained, masters)
    .flatMap(mergeVariants)
    // Positional station.lines indices make line order load-bearing: sort by
    // name then relation id so two runs over the same raw diff clean.
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.osmRelationId - b.osmRelationId)

  const { stations, unnamedStopCount } = buildStations(lines, nodesById, rules.renameStations)
  for (const rule of rules.renameStations) {
    if (stations.some((s) => s.osmNodeIds?.includes(rule.osmNodeId))) curationApplied.add(rule.ruleId)
  }

  const candidate = {
    city: rawEnvelope.city,
    meta: {
      source: rawEnvelope.endpoint?.startsWith('file:') ? 'overpass-file' : 'overpass',
      fetchedAt: rawEnvelope.fetchedAt,
      overpassEndpoint: rawEnvelope.endpoint,
      osmDataTimestamp: rawEnvelope.osmDataTimestamp,
      parsedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      curationApplied: [...curationApplied].sort(),
      excludedRelations,
    },
    lines: lines.map((line) => ({
      name: line.name,
      color: line.color,
      path: line.path,
      osmRelationId: line.osmRelationId,
      osmRouteMasterId: line.osmRouteMasterId,
      variantRelationIds: line.variantRelationIds,
    })),
    stations,
  }

  const parseLog = {
    city: rawEnvelope.city,
    routeRelations: routes.length,
    activeRelations: active.length,
    excludedRelations,
    lines: lines.map((line) => ({
      name: line.name,
      osmRelationId: line.osmRelationId,
      variants: line.variantRelationIds.length,
      components: line.chainLog.componentCount,
      chainBreaks: line.chainLog.breaks,
      stationMethod: chained.find((c) => c.relation.id === line.osmRelationId)?.stationMethod ?? 'none',
    })),
    unnamedStopCount,
  }

  return { candidate, parseLog }
}
