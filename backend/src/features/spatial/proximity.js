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
 * A distance rendered the way a person weighs it: walk time first while
 * walking is realistic, plain distance beyond that.
 *
 *   90   → "about a 2 min walk (90 m)"
 *   420  → "about a 6 min walk (420 m)"
 *   2300 → "2.3 km away"
 */
export function walkDisplay(meters) {
  if (meters <= MAX_WALK_PHRASE_M) {
    const min = walkMinutes(meters)
    return `about a ${min} min walk (${formatDistance(meters)})`
  }
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
