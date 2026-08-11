// Where POI facts come from, and how much each source is worth.
//
// A CODE-OWNED config, not a table. Follows RankingWeights' precedent
// (.claude/graph.md): the code owns the defaults, so an empty database is a
// working system and there is no second copy of these numbers free to drift
// from the comments that explain them. Promote to a table when an operator
// genuinely needs to change a reliability without a deploy — which is a real
// need only once there are enough sources for the ordering to be arguable.
//
// LICENSING IS PART OF THE CONFIG, not a footnote. `persistable: false` means
// we may query the source and show the answer, and may NOT store it — which is
// why Google-sourced facts never carry an `at` coordinate (envelope.js) and
// never reach PoiIndex. A source added here without checking its terms is how a
// licence breach ships as a schema change.

/**
 * `reliability` is a 0..1 prior on a source's assertions, used as the STARTING
 * point for attribute confidence before any reduction. It is a prior, not a
 * measurement — nothing here has been benchmarked against ground truth, and the
 * comment on each says what it is actually based on. When conflict history has
 * accumulated enough rows to measure disagreement, these become measurable and
 * should be replaced by the measurement.
 *
 * `attributes` is what a source is allowed to assert. Narrower than "everything
 * it returns": India Post knows a pincode's district authoritatively and knows
 * nothing about a restaurant's hours, and letting a source speak outside its
 * competence is how a confident wrong answer gets built out of two right ones.
 */
export const POI_SOURCES = {
  osm: {
    label: 'OpenStreetMap',
    licence: 'ODbL',
    persistable: true,
    // 0.85 rather than 0.9+: OSM is genuinely good on things that are large,
    // civic and surveyed, and genuinely thin on small Indian retail — where
    // coverage varies more between two neighbourhoods of one city than between
    // two countries. A single number cannot express that, which is exactly why
    // it is a starting point that other factors reduce.
    reliability: 0.85,
    attributes: ['location', 'identity', 'category', 'address', 'contact', 'hours'],
  },
  // India Post's pincode directory. Not a POI source — it cannot tell you a
  // place exists — but it is authoritative for exactly one thing, which makes
  // it the only ground truth in this file.
  india_post: {
    label: 'India Post',
    licence: 'data.gov.in',
    persistable: true,
    reliability: 0.98,
    attributes: ['address'],
  },
  // Queried live, never stored. Present so that a fact sourced this way has
  // somewhere honest to point, and so `persistable` states the rule that keeps
  // it out of PoiIndex rather than leaving it as folklore.
  google_places: {
    label: 'Google Places',
    licence: 'proprietary — query only, retention prohibited',
    persistable: false,
    reliability: 0.9,
    attributes: ['location', 'identity', 'category', 'hours'],
  },
}

// An unknown source is not a trusted one. Deliberately low rather than a
// middling default: a source nobody has written down here is a source nobody
// has checked the terms of.
const UNKNOWN_SOURCE = {
  label: 'unknown',
  licence: 'unknown',
  persistable: false,
  reliability: 0.4,
  attributes: [],
}

export function sourceFor(id) {
  return POI_SOURCES[id] ?? UNKNOWN_SOURCE
}

/** May this source's data be written to our database at all? */
export function isPersistable(id) {
  return sourceFor(id).persistable === true
}

/** May this source speak about this attribute? */
export function canAssert(id, attribute) {
  return sourceFor(id).attributes.includes(attribute)
}
