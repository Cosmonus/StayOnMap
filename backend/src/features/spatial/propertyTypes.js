// What "relevant intelligence" means per property type.
//
// The spatial layer shipped with one module set for everything, which is wrong
// in a way that shows: a LAND listing was being asked "could you live here
// without a car?" and given a walkability score. Nobody lives on a plot.
//
// The tension this file resolves: context is keyed by a geohash CELL, but
// property type is per LISTING — one cell can hold a flat, a shop and a plot.
// So the split is:
//
//   cell-level    facts about the PLACE (metro distance, POI density, air) —
//                 type-agnostic, computed once, shared by every listing there
//   type-level    WHICH modules render, and how a module frames its answer
//   listing-level approvalStatus, frontage, powerLoad, totalBeds — not spatial
//                 at all; these belong to property intelligence, not here
//
// Modules stay cell-level. Type only decides what surfaces. That keeps the
// cost model intact — a `commerce` module is computed once for a cell and
// reused by every shop in it.

/**
 * PropertyType enum values that are somebody's home. Grouped because the
 * distinction that matters to a spatial module is "does a person live here",
 * not which of four house styles it is.
 */
export const RESIDENTIAL_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE']

export const ALL_TYPES = [...RESIDENTIAL_TYPES, 'PG', 'COMMERCIAL', 'LAND', 'SHORT_STAY']

/**
 * Where the peak-hour drive should measure TO, per type.
 *
 * Same module, different destination — rather than four near-duplicate
 * mobility modules. The old behaviour (always the nearest IT corridor) is
 * right for a flat and meaningless for a holiday rental: tourists do not
 * commute to Manyata Tech Park.
 */
export const COMMUTE_TARGET = {
  // Where the residents of this home would travel every morning.
  APARTMENT: 'employment',
  HOUSE: 'employment',
  VILLA: 'employment',
  INDEPENDENT_HOUSE: 'employment',
  PG: 'employment',
  // Guests arrive from somewhere before they do anything else.
  SHORT_STAY: 'arrival',
  // A shop's question is how close it sits to the commercial core its
  // customers come from.
  COMMERCIAL: 'city_core',
  // For a plot, distance to the built-up core is the closest honest proxy for
  // how developed the surroundings already are.
  LAND: 'city_core',
}

/**
 * Which property types each module is worth showing for.
 *
 * A module lists itself here via `appliesTo`; this map is the fallback for
 * anything that doesn't. Irrelevant modules are HIDDEN rather than shown with
 * a caveat — a warehouse listing carrying a "Daily life" card that explains
 * why it's inapplicable is worse than one that simply doesn't.
 */
export function appliesToType(module, propertyType) {
  // No type given (e.g. GET /spatial/at for an arbitrary coordinate) → show
  // everything that has been computed. The map is a per-listing filter, not a
  // statement about where a module is allowed to exist.
  if (!propertyType) return true
  if (!module.appliesTo) return true
  return module.appliesTo.includes(propertyType)
}

// modulesForType(modules, type) lived here until 2026-08-10 — a one-line
// `.filter(appliesToType)` with no importer. Callers use appliesToType directly,
// which is the predicate they actually need.
