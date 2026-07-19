// Is this route relation an operational line, or something that must not
// reach the map? Under-construction/proposed contamination is the bug class
// that put Chennai's unopened Phase 2 on the map — the fix is that every
// exclusion here is tag- or curation-driven and carries a logged reason, so
// "not on the map" is always evidence, never absence.
export function classifyRoute(relation, cityRules) {
  const tags = relation.tags ?? {}
  const name = tags.name ?? `relation ${relation.id}`

  const excluded = (reason) => ({ status: 'excluded', id: relation.id, name, reason })

  if (tags.route === 'construction' || tags.route === 'proposed') {
    return excluded(`route=${tags.route}`)
  }
  if (tags.state === 'proposed' || tags.state === 'construction') {
    return excluded(`state=${tags.state}`)
  }
  if (tags.construction && tags.construction !== 'no') {
    return excluded(`construction=${tags.construction}`)
  }
  // Lifecycle-prefixed keys (proposed:route=subway etc.) mark relations whose
  // main tags look operational but whose lifecycle says otherwise.
  for (const key of Object.keys(tags)) {
    if (key.startsWith('proposed:') || key.startsWith('construction:')) {
      return excluded(`lifecycle tag ${key}`)
    }
  }

  for (const rule of cityRules.excludeRelations) {
    if (rule.id === relation.id) return excluded(`curation ${rule.ruleId}: ${rule.reason}`)
  }
  for (const rule of cityRules.excludeNamePatterns) {
    if (new RegExp(rule.pattern).test(tags.name ?? '')) {
      return excluded(`curation ${rule.ruleId} (pattern ${rule.pattern}): ${rule.reason}`)
    }
  }

  return { status: 'active', id: relation.id, name }
}
