// Repair composer: candidate network → repaired network + a log of every
// change. Idempotent by construction — repairing a repaired network yields an
// empty change list, and a test holds it to that.
import {
  dedupeConsecutivePoints,
  dropTinyFragments,
  orderComponents,
  normalizeColor,
  mergeDuplicateLines,
  reindexStationLines,
  normalizeLineNames,
  applyCurationRenames,
} from './repairs.js'
import { cityCuration } from '../curation.js'

export function repairNetwork(candidate, curation) {
  const rules = cityCuration(curation, candidate.city)
  const changes = []
  const change = (op, detail) => changes.push({ op, ...detail })

  // Per-line geometry cleanup first, so the city-wide merge compares clean
  // paths.
  let lines = candidate.lines.map((line) => {
    let { path } = line

    const deduped = dedupeConsecutivePoints(path)
    if (deduped.removedCount) change('dedupe-consecutive-points', { line: line.name, removed: deduped.removedCount })
    path = deduped.path

    const trimmed = dropTinyFragments(path)
    if (trimmed.dropped.length) change('drop-tiny-fragments', { line: line.name, dropped: trimmed.dropped })
    path = trimmed.path

    const ordered = orderComponents(path)
    if (ordered.reordered) change('order-components', { line: line.name })
    path = ordered.path

    const color = normalizeColor(line.color)
    if (color.changed) change('normalize-color', { line: line.name, from: line.color, to: color.color })
    if (line.color && !color.recognized) change('unrecognized-color', { line: line.name, color: line.color })

    return { ...line, path, color: color.color }
  })

  const dedupedLines = mergeDuplicateLines(lines)
  for (const m of dedupedLines.merged) change('merge-duplicate-lines', m)
  lines = dedupedLines.lines
  const stations = reindexStationLines(candidate.stations, dedupedLines.indexMap)

  const named = normalizeLineNames(lines)
  for (const r of named.renamed) change('normalize-line-name', r)
  lines = named.lines

  const curated = applyCurationRenames({ ...candidate, lines, stations }, rules)
  for (const a of curated.applied) change('curation-rename', a)

  const network = {
    ...curated.network,
    meta: {
      ...candidate.meta,
      curationApplied: [...new Set([
        ...(candidate.meta?.curationApplied ?? []),
        ...curated.applied.map((a) => a.ruleId),
      ])].sort(),
    },
  }

  return { network, log: { city: candidate.city, changes } }
}
