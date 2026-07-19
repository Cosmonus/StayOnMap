// Candidate vs currently-shipped diff, plus the promotion gate. This report
// is the human review surface for a promote — it must make every removal,
// addition, rename, and geometry change explicit, because "the pipeline
// changed the map and nobody noticed" is the failure mode the engine exists
// to end.
import { validateNetwork, haversineMeters } from '../../lib/metro-validation/index.js'

const STATION_MOVED_METERS = 50

const normalizeName = (name) => (name ?? '').trim().toLowerCase()

const pathLengthMeters = (path) => {
  let total = 0
  for (let i = 1; i < path.length; i++) total += haversineMeters(path[i - 1], path[i])
  return Math.round(total)
}

// Pairs candidate/shipped entries by OSM id when both sides carry one (true
// after the first promote), by normalized name otherwise (the first promote,
// against hand-era data with no ids).
function matchBy(candidates, shipped, idKey) {
  const pairs = []
  const unmatchedShipped = [...shipped]
  const unmatchedCandidates = []

  for (const candidate of candidates) {
    let index = -1
    if (candidate[idKey] != null) {
      index = unmatchedShipped.findIndex((s) => s[idKey] === candidate[idKey])
    }
    if (index === -1) {
      index = unmatchedShipped.findIndex((s) => normalizeName(s.name) === normalizeName(candidate.name))
    }
    if (index === -1) unmatchedCandidates.push(candidate)
    else pairs.push({ candidate, shipped: unmatchedShipped.splice(index, 1)[0] })
  }
  return { pairs, added: unmatchedCandidates, removed: unmatchedShipped }
}

export function compareNetworks(candidate, shipped) {
  const lineMatch = matchBy(candidate.lines, shipped.lines, 'osmRelationId')
  const lines = {
    matched: lineMatch.pairs.length,
    added: lineMatch.added.map((l) => l.name),
    removed: lineMatch.removed.map((l) => l.name),
    renamed: lineMatch.pairs
      .filter((p) => p.candidate.name !== p.shipped.name)
      .map((p) => ({ from: p.shipped.name, to: p.candidate.name })),
    geometryDeltas: lineMatch.pairs.map((p) => {
      const candidateLength = pathLengthMeters(p.candidate.path)
      const shippedLength = pathLengthMeters(p.shipped.path)
      return {
        line: p.candidate.name,
        lengthDeltaMeters: candidateLength - shippedLength,
        lengthDeltaPct: shippedLength ? Math.round(((candidateLength - shippedLength) / shippedLength) * 100) : null,
        pointCountDelta: p.candidate.path.length - p.shipped.path.length,
      }
    }).filter((d) => d.lengthDeltaMeters !== 0 || d.pointCountDelta !== 0),
  }

  const stationMatch = matchBy(candidate.stations, shipped.stations, 'osmNodeId')
  const stations = {
    matched: stationMatch.pairs.length,
    added: stationMatch.added.map((s) => s.name),
    removed: stationMatch.removed.map((s) => s.name),
    moved: stationMatch.pairs
      .map((p) => ({
        name: p.candidate.name,
        meters: Math.round(haversineMeters([p.candidate.lat, p.candidate.lng], [p.shipped.lat, p.shipped.lng])),
      }))
      .filter((m) => m.meters > STATION_MOVED_METERS),
  }

  const candidateValidation = validateNetwork(candidate)
  const shippedValidation = validateNetwork(shipped)
  const validation = {
    candidateErrors: candidateValidation.errors.length,
    candidateWarnings: candidateValidation.warnings.length,
    shippedWarnings: shippedValidation.warnings.length,
    candidateErrorList: candidateValidation.errors,
  }

  // The promotion gate. No --force exists: a failing gate is fixed with a
  // curation rule or a baselined warning, both reviewable data.
  const reasons = []
  if (!candidate.lines.length && (shipped.lines.length || shipped.stations.length)) {
    reasons.push('candidate is empty while shipped data has content (e.g. a failed/empty fetch) — nothing to promote')
  }
  if (validation.candidateErrors > 0) reasons.push(`${validation.candidateErrors} validation error(s)`)
  if (validation.candidateWarnings > validation.shippedWarnings) {
    reasons.push(`more warnings than shipped (${validation.candidateWarnings} vs ${validation.shippedWarnings})`)
  }

  return {
    city: candidate.city,
    comparedAt: new Date().toISOString(),
    osmDataTimestamp: candidate.meta?.osmDataTimestamp ?? null,
    lines,
    stations,
    validation,
    gate: { pass: reasons.length === 0, reasons },
  }
}
