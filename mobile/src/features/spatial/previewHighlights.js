// Compact "what's nearby" picks for the map's pin preview card. Mirror of
// frontend/src/features/spatial/previewHighlights.js — reads the same
// envelope facts the full spatial panel renders; numbers are never recomputed
// here, only shortened. Values are the property-anchored distances the read
// path already re-derived; shown as plain distance, never a walk time (see
// docs/spatial-intelligence.md on why assumed walk times were removed).
const PICKS = [
  { key: 'nearest_metro', label: 'Metro' },
  { key: 'nearest_supermarket', label: 'Groceries' },
  { key: 'nearest_hospital', label: 'Hospital' },
  { key: 'nearest_school', label: 'School' },
  { key: 'nearest_pharmacy', label: 'Pharmacy' },
]

const formatM = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

export function previewHighlights(context, max = 2) {
  const modules = context?.modules ?? {}
  const facts = Object.values(modules).flatMap((e) => (Array.isArray(e?.facts) ? e.facts : []))
  const out = []
  for (const pick of PICKS) {
    const fact = facts.find((f) => f?.key === pick.key && typeof f.value === 'number')
    if (!fact) continue
    out.push({ key: pick.key, label: pick.label, distance: formatM(fact.value) })
    if (out.length >= max) break
  }
  return out
}
