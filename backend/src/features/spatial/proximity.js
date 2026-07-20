// The shared vocabulary for turning a measured distance into something a
// person can picture — "about a 6 min walk (420 m)" instead of "420 m".
//
// One file because four modules were each hand-writing their own phrasing
// ("within a 5-minute walk", "within a 10-minute walk") with slightly
// different arithmetic, and a vocabulary that drifts per module reads as four
// different opinions about the same street.
//
// The honesty contract, stated once: a walking TIME is an estimate — the
// distance is measured, but the conversion assumes streets detour 1.35x over
// the straight line and a 4.8 km/h pace. Any fact whose display leans on
// walkMinutes() must either be ESTIMATED itself or sit in a module that
// discloses WALK_METHOD (mobility's separate `walk_time_metro` fact is the
// canonical example). The docs' own envelope example blesses embedding the
// walk phrase in a MEASURED distance's display — the value stays the measured
// metres; the phrasing is presentation. See docs/spatial-intelligence.md §5.0.

export const DETOUR_FACTOR = 1.35
export const WALK_SPEED_KMH = 4.8
export const WALK_METHOD =
  'straight-line distance x 1.35 (typical street detour) at 4.8 km/h walking pace'

// Beyond this, calling something "a walk" stops being honest — 1.2 km is
// already ~17 minutes on foot in an Indian summer.
export const MAX_WALK_PHRASE_M = 1200

/** Estimated minutes on foot. Never less than 1 — "0 min walk" reads as a lie. */
export function walkMinutes(meters) {
  return Math.max(1, Math.round((meters * DETOUR_FACTOR) / 1000 / WALK_SPEED_KMH * 60))
}

/** "12563 m" is a measurement; "12.6 km" is a distance a person can picture. */
export function formatDistance(meters) {
  const m = Math.round(meters)
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

/**
 * A distance, rendered plainly.
 *
 *   90   → "90 m away"
 *   420  → "420 m away"
 *   2300 → "2.3 km away"
 *
 * This used to lead with a walk time — "about a 6 min walk (420 m)". It no
 * longer does, and the reason is worth keeping:
 *
 * The distance is real. The minutes were two assumptions stacked on top of it —
 * a 1.35x detour factor and a 4.8 km/h pace — applied to a STRAIGHT LINE that
 * may not be walkable at all. In Indian cities that is not a rounding error:
 * across a rail line, a nullah, or an arterial with no crossing, a 420 m
 * straight line is a 1.5 km walk. We said six minutes; the truth was twenty.
 *
 * A DERIVED fact must not smuggle an estimate into its display. If the value is
 * measured, the display says the measured thing. An honest metre count a reader
 * can judge for themselves beats a confident minute count that is wrong exactly
 * where it matters most.
 *
 * Walk time comes back the day a routing engine can MEASURE it (see
 * docs/spatial-intelligence.md, Phase 3) — as network distance, not arithmetic.
 * Until then `walkMinutes` survives for facts that are explicitly ESTIMATED and
 * disclose WALK_METHOD, which is the contract that makes an estimate honest.
 */
export function walkDisplay(meters) {
  return `${formatDistance(meters)} away`
}

/**
 * The graded proximity phrase for assessments and summaries. Bands, not fake
 * precision — these appear in sentences, where "roughly" is the honest tone.
 */
export function describeProximity(meters) {
  if (meters < 150) return 'just around the corner'
  if (meters < 500) return 'a short walk away'
  if (meters <= MAX_WALK_PHRASE_M) return 'within walking distance'
  if (meters < 2500) return 'a quick ride away'
  return `${formatDistance(meters)} away`
}
