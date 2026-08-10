// Per-category POI policy — how big a place is, and how fast its data rots.
//
// A DECLARED TABLE, not conditionals scattered through the pipeline. Same
// pattern and the same reason as features/spatial/propertyTypes.js: the moment
// "a hospital is different from a kirana" is expressed as an `if` inside a
// dedupe loop, the next person adds a second `if` somewhere else and the two
// disagree.
//
// Two INDEPENDENT axes, kept independent on purpose. The single "stability
// class" a POI brief usually asks for conflates them, and they are genuinely
// unrelated:
//
//   FOOTPRINT   how far apart two records can be and still be one place.
//               A hospital campus is 400 m across; a paan shop is a point.
//   VOLATILITY  how quickly the stored facts stop being true.
//               A metro station outlives our database. A salon changes hands
//               twice a year. Neither says anything about the other — an
//               airport is enormous AND stable, a food court is tiny AND
//               volatile, but a mall is enormous and its tenants churn.
//
// Every number here is a DEFAULT, not a measurement. They are starting points
// chosen from the shape of Indian urban form; PoiConflict rows are what will
// eventually replace them with something measured (see the conflict-rate rollup
// in dataQuality.js). Say so when quoting them.

/**
 * How far apart two same-category records can be and still be one place.
 *
 * `unnamedM` is the tighter number and applies when either record has no name:
 * an unnamed point that close is almost always OSM's own node/way double of a
 * named neighbour, not a second business. `namedM` is the outer bound, and it
 * additionally requires the names to agree — see places.js's samePlace.
 *
 * Both err toward "different places". A miss creates a duplicate, which is
 * annoying and self-heals on the next conflation pass. A false merge DESTROYS a
 * real place and cannot be undone from the merged row.
 */
export const FOOTPRINTS = {
  // A single doorway. Two of these 30 m apart are two businesses.
  POINT:  { unnamedM: 20,  namedM: 60 },
  // One shopfront, possibly mapped as both a node and its building.
  SMALL:  { unnamedM: 30,  namedM: 100 },
  // A compound with a gate: a school, a park, a station box.
  MEDIUM: { unnamedM: 60,  namedM: 150 },
  // A campus mapped in pieces — blocks, wings, entrances.
  LARGE:  { unnamedM: 120, namedM: 400 },
  // Terminals, runways, perimeter roads.
  CAMPUS: { unnamedM: 300, namedM: 1000 },
}

/**
 * How long the stored facts deserve full confidence.
 *
 * Bands rather than a decay curve, matching dataQuality.js's FRESHNESS_BANDS:
 * a smooth function of age implies we can tell 200-day-old data from
 * 210-day-old data, and we cannot.
 *
 * `refreshDays` is the intended re-ingestion cadence — what a scheduler would
 * use. `fullConfidenceDays` is when a penalty starts. They differ because data
 * does not become wrong the instant a refresh is due.
 */
export const VOLATILITY = {
  // Small independent businesses. Open, close and change hands constantly.
  VOLATILE: { refreshDays: 30,  fullConfidenceDays: 45 },
  // Established local infrastructure. Moves, but on the scale of years.
  MODERATE: { refreshDays: 90,  fullConfidenceDays: 120 },
  // Civic and transport. Outlives our database; changes are news.
  STABLE:   { refreshDays: 365, fullConfidenceDays: 400 },
}

/**
 * category → { footprint, volatility }
 *
 * Covers every key in poiCategories.js's POI_CATEGORIES. A test asserts that,
 * because a category added there and forgotten here would silently fall back to
 * the default and nothing would say so.
 */
export const POI_POLICY = {
  // ── Daily needs
  supermarket:  { footprint: 'SMALL',  volatility: 'MODERATE' },
  // A weekly sabzi mandi occupies a street, not a unit.
  marketplace:  { footprint: 'MEDIUM', volatility: 'MODERATE' },
  pharmacy:     { footprint: 'SMALL',  volatility: 'MODERATE' },

  // ── Civic
  hospital:     { footprint: 'LARGE',  volatility: 'STABLE' },
  clinic:       { footprint: 'SMALL',  volatility: 'MODERATE' },
  school:       { footprint: 'MEDIUM', volatility: 'STABLE' },
  college:      { footprint: 'LARGE',  volatility: 'STABLE' },
  government:   { footprint: 'MEDIUM', volatility: 'STABLE' },
  police:       { footprint: 'MEDIUM', volatility: 'STABLE' },
  fire_station: { footprint: 'MEDIUM', volatility: 'STABLE' },

  // ── Leisure. The volatile end of the vocabulary: this is where a quarterly
  // refresh is genuinely too slow, and where a stale row does most of its
  // damage ("there's a cafe downstairs" is why someone took the flat).
  restaurant:   { footprint: 'SMALL',  volatility: 'VOLATILE' },
  cafe:         { footprint: 'POINT',  volatility: 'VOLATILE' },
  food_cheap:   { footprint: 'POINT',  volatility: 'VOLATILE' },
  gym:          { footprint: 'SMALL',  volatility: 'VOLATILE' },
  park:         { footprint: 'MEDIUM', volatility: 'STABLE' },

  // ── Infrastructure
  bank:         { footprint: 'SMALL',  volatility: 'MODERATE' },
  // Two ATMs in one bank lobby are two ATMs; the tier has to be tight.
  atm:          { footprint: 'POINT',  volatility: 'VOLATILE' },
  fuel:         { footprint: 'SMALL',  volatility: 'MODERATE' },
  ev_charging:  { footprint: 'POINT',  volatility: 'VOLATILE' },

  // ── Transit. Stations move only when a line is rebuilt, which is a decade's
  // notice, and MEDIUM covers a station box with entrances mapped separately.
  bus_stop:        { footprint: 'MEDIUM', volatility: 'MODERATE' },
  taxi:            { footprint: 'POINT',  volatility: 'VOLATILE' },
  metro_station:   { footprint: 'MEDIUM', volatility: 'STABLE' },
  railway_station: { footprint: 'LARGE',  volatility: 'STABLE' },
  airport:         { footprint: 'CAMPUS', volatility: 'STABLE' },

  // ── Type-specific
  attraction:   { footprint: 'LARGE',  volatility: 'STABLE' },
  hotel:        { footprint: 'MEDIUM', volatility: 'MODERATE' },
  laundry:      { footprint: 'POINT',  volatility: 'VOLATILE' },
  // The footfall basket — individual shopfronts, and they turn over fast.
  retail:       { footprint: 'SMALL',  volatility: 'VOLATILE' },
  // A mall is one building whose TENANTS churn; the building does not.
  mall:         { footprint: 'LARGE',  volatility: 'STABLE' },
}

/**
 * The fallback for a category with no entry.
 *
 * POINT and VOLATILE, and both directions are the conservative one:
 *   - the TIGHTEST footprint merges the fewest records, and a false merge is
 *     the unrecoverable error;
 *   - the SHORTEST freshness claims the least, and under-claiming confidence is
 *     the failure this layer is allowed to have.
 */
const DEFAULT_POLICY = { footprint: 'POINT', volatility: 'VOLATILE' }

/** @returns {{footprint: string, volatility: string}} */
export function policyFor(category) {
  return POI_POLICY[category] ?? DEFAULT_POLICY
}

/** Dedupe radii for a category. @returns {{unnamedM: number, namedM: number}} */
export function footprintFor(category) {
  return FOOTPRINTS[policyFor(category).footprint]
}

/** Freshness bands for a category. */
export function volatilityFor(category) {
  return VOLATILITY[policyFor(category).volatility]
}

/**
 * How far a place may move before we call it a move rather than a nudge.
 *
 * Deliberately the footprint's OWN `namedM` rather than a third number. Inside
 * its footprint a coordinate change is a mapper refining where the entrance is,
 * which happens constantly and is not a finding. Beyond it, the record is
 * pointing somewhere else. Introducing a separate constant would create two
 * numbers that must agree with nothing making them agree.
 */
export function moveThresholdM(category) {
  return footprintFor(category).namedM
}

// Beyond this, a "move" is not a correction — it is a mis-tag, a mis-import or
// vandalism, and applying it would put a hospital in another suburb.
//
// A FLOOR of 2 km with a per-category escape hatch, because an airport whose
// footprint is already 1 km cannot use the same bar as a paan shop. Five
// footprints out is the point at which no amount of campus sprawl explains it.
const IMPLAUSIBLE_FLOOR_M = 2000

/**
 * The withhold threshold. A move beyond this is RECORDED and NOT APPLIED — the
 * one case where we keep our older value in preference to the source's newer
 * one, because the source is more likely to be wrong than we are.
 */
export function implausibleMoveM(category) {
  return Math.max(IMPLAUSIBLE_FLOOR_M, moveThresholdM(category) * 5)
}
