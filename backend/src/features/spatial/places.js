// Entity resolution for places — when are two POI records the SAME place?
//
// The rule, exercised first by the Overture bake-off (docs/
// overture-bakeoff-2026-07-20.md) and promoted here unchanged:
//
//   same mapped category AND ( within 50 m regardless of name,
//                              OR within 150 m with name similarity >= 0.5 )
//
// Both thresholds are deliberately conservative. 50 m is within one
// building's footprint — two same-category records that close are one place
// under any spelling. 150 m needs the name to agree because Indian commercial
// streets pack several pharmacies into a block, and distance alone would
// merge competitors. A miss creates a duplicate Place (annoying, self-heals
// on the next conflation pass); a false merge DESTROYS a real place — so
// every threshold errs toward "different".
import { haversineMeters } from '../../lib/geohash.js'

/** Lowercase, strip punctuation, collapse whitespace → comparable tokens. */
export function normalizeName(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Token overlap over the SMALLER token set — so "Apollo Pharmacy" matches
 * "Apollo Pharmacy Koramangala Branch" (a subset name is the same business,
 * just spelled longer) while "Apollo Pharmacy" vs "MedPlus" stays 0.
 */
export function nameSimilarity(a, b) {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean))
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.min(ta.size, tb.size)
}

/**
 * The match rule. Both records must already be the same category — the
 * caller's query guarantees it, and this function does not re-check.
 *
 * Within 50 m, a NAMED disagreement still keeps records separate — tightened
 * from the bake-off's draft rule after the first Chennai backfill claimed
 * 22.5% of OSM rows were "doubles": on a packed Indian commercial street two
 * different same-category businesses within 50 m are routine, and merging
 * them destroys a real place. An unnamed record can't disagree, so it merges
 * on distance alone (that's the node/way double this leg exists for).
 */
export function samePlace(a, b) {
  const d = haversineMeters(a.lat, a.lng, b.lat, b.lng)
  const sim = nameSimilarity(a.name, b.name)
  const eitherUnnamed = !normalizeName(a.name) || !normalizeName(b.name)
  if (d <= 50) return eitherUnnamed || sim >= 0.5
  if (d <= 150 && sim >= 0.5) return true
  return false
}

/**
 * Conflate one source record against candidate places (same category, nearby
 * — the caller supplies them from a bbox query or an in-memory grid).
 * Returns the matched place or null. First match wins: candidates should be
 * supplied nearest-first when order matters.
 */
export function matchPlace(record, candidates) {
  for (const place of candidates) {
    if (samePlace(record, place)) return place
  }
  return null
}
