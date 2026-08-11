// Old behaviour vs new, measured rather than assumed.
//
// PURE — the script that samples the database is separate, so the comparison
// itself is testable without one.
//
// What is genuinely comparable, and what is not
// ---------------------------------------------
// Only DEDUPE has a meaningful before and after. It changed from one flat
// 30/150 m rule to a per-category footprint (poiPolicy.js), it runs on every
// read, and it decides what a user sees: how many pharmacies are "nearby" and
// which one is "nearest".
//
// The other two changes are deliberately NOT shadowed, because a comparison
// would be theatre:
//   - Absence marking has no old output to compare against. The old path
//     DELETED the rows, so the baseline no longer exists — which is the entire
//     reason it had to stop.
//   - TrustScore is new. There is no previous number, and comparing it against
//     nothing would produce a report full of "differs" that means "exists".
// For scoring, the honest artefact is a DISTRIBUTION an operator can read
// before switching the job on, which is what summariseScores produces.
import { haversineMeters } from '../../lib/geohash.js'
import { footprintFor } from './poiPolicy.js'

// The rule as it stood before 2026-08-11, frozen. A shadow comparator has to
// hold the old behaviour somewhere, and a frozen copy here is honest about what
// it is: this is NOT a fallback, nothing calls it in production, and it should
// be deleted along with this file once the comparison has served its purpose.
const LEGACY_UNNAMED_M = 30
const LEGACY_NAMED_M = 150

function normalizedName(poi) {
  const raw = poi.name ?? poi.brand ?? null
  return raw ? raw.toLowerCase().replace(/\s+/g, ' ').trim() : null
}

/**
 * Dedupe with an explicit pair of radii. The shape of poiProvider.js's
 * dedupeCategory, parameterised so both the old and new thresholds can be run
 * over identical input.
 */
export function dedupeWith(sorted, unnamedM, namedM) {
  const kept = []
  for (const poi of sorted) {
    const name = normalizedName(poi)
    let isDup = false
    for (let i = kept.length - 1; i >= 0; i--) {
      const k = kept[i]
      if (poi.distanceM - k.distanceM > namedM) break
      const d = haversineMeters(poi.lat, poi.lng, k.lat, k.lng)
      if (name ? normalizedName(k) === name && d <= namedM : d <= unnamedM) {
        isDup = true
        break
      }
    }
    if (!isDup) kept.push(poi)
  }
  return kept
}

/** A stable identity for a POI in a comparison. */
const idOf = (p) => p.osmId ?? p.id ?? `${p.lat},${p.lng},${p.name ?? ''}`

/**
 * What changes for one category's distance-sorted hit list.
 *
 * `appeared` are places the new rule KEEPS that the old one collapsed away —
 * mostly genuinely-distinct neighbours the flat 150 m merged. `disappeared` are
 * places the new rule collapses that the old one kept — mostly campus blocks
 * the flat rule split into several hospitals.
 *
 * Both directions are reported separately and never netted. A net of zero can
 * mean "nothing changed" or "twelve wrong merges traded for twelve wrong
 * splits", and those are not the same result.
 *
 * @param {Array} sorted  distance-sorted hits for ONE category
 * @param {string} category
 */
export function compareDedupe(sorted, category) {
  const { unnamedM, namedM } = footprintFor(category)
  const legacy = dedupeWith(sorted, LEGACY_UNNAMED_M, LEGACY_NAMED_M)
  const next = dedupeWith(sorted, unnamedM, namedM)

  const legacyIds = new Set(legacy.map(idOf))
  const nextIds = new Set(next.map(idOf))

  const appeared = next.filter((p) => !legacyIds.has(idOf(p)))
  const disappeared = legacy.filter((p) => !nextIds.has(idOf(p)))

  return {
    category,
    input: sorted.length,
    legacyCount: legacy.length,
    nextCount: next.length,
    appeared: appeared.length,
    disappeared: disappeared.length,
    // The number a user would actually notice: "nearest pharmacy 240 m" moving.
    // Null when either side found nothing, never 0 — 0 means "it did not move".
    nearestLegacyM: legacy[0]?.distanceM ?? null,
    nearestNextM: next[0]?.distanceM ?? null,
    nearestChanged: (legacy[0] ? idOf(legacy[0]) : null) !== (next[0] ? idOf(next[0]) : null),
    thresholds: { legacy: [LEGACY_UNNAMED_M, LEGACY_NAMED_M], next: [unnamedM, namedM] },
  }
}

/**
 * Roll several per-category comparisons into one readable verdict.
 *
 * `categoriesChanged` rather than a percentage of POIs: a change confined to
 * one category is a threshold to re-examine, while the same count spread across
 * every category is the rule behaving as designed. A single percentage hides
 * which of those you have.
 */
export function summariseDedupe(comparisons) {
  const byCategory = {}
  let appeared = 0
  let disappeared = 0
  let nearestChanged = 0

  for (const c of comparisons) {
    const acc = (byCategory[c.category] ??= {
      samples: 0, appeared: 0, disappeared: 0, nearestChanged: 0, thresholds: c.thresholds,
    })
    acc.samples++
    acc.appeared += c.appeared
    acc.disappeared += c.disappeared
    if (c.nearestChanged) acc.nearestChanged++
    appeared += c.appeared
    disappeared += c.disappeared
    if (c.nearestChanged) nearestChanged++
  }

  return {
    samples: comparisons.length,
    appeared,
    disappeared,
    nearestChanged,
    categoriesChanged: Object.values(byCategory)
      .filter((c) => c.appeared || c.disappeared).length,
    byCategory,
  }
}

// Where the band boundaries sit, matching envelope.js's CONFIDENCE_BANDS so a
// POI's trust band and a module's confidence band mean the same thing to a
// reader looking at both on one screen.
const SCORE_BANDS = [
  { min: 75, band: 'HIGH' },
  { min: 50, band: 'MODERATE' },
  { min: 25, band: 'LOW' },
  { min: 0, band: 'MINIMAL' },
]

/**
 * The score distribution, for an operator deciding whether to switch scoring on.
 *
 * Deliberately NOT a single average. An average trust score is the least useful
 * number this data can produce: it describes no POI, and it moves for reasons
 * (a city getting seeded, a category being added) that have nothing to do with
 * quality changing. Bands and a count of unscored rows are what a person can
 * act on.
 *
 * @param {Array<{trustScore: number|null}>} rows
 */
export function summariseScores(rows) {
  const bands = { HIGH: 0, MODERATE: 0, LOW: 0, MINIMAL: 0 }
  let unscored = 0
  for (const r of rows) {
    if (r.trustScore == null) { unscored++; continue }
    bands[SCORE_BANDS.find((b) => r.trustScore >= b.min).band]++
  }
  return {
    total: rows.length,
    // Its own number, never folded into MINIMAL. "Never scored" and "scored
    // badly" are the distinction this whole layer exists to preserve, and a
    // rollout report is the worst possible place to lose it.
    unscored,
    bands,
  }
}
