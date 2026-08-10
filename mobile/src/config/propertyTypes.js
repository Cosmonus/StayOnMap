// How each PropertyType presents itself: its word, its map colour, and its
// icon. One declared table rather than type conditionals scattered per screen —
// the pattern backend/src/features/spatial/propertyTypes.js sets.
//
// Six WIZARD CATEGORIES, eight enum values: HOUSE / VILLA / INDEPENDENT_HOUSE
// are one category in the listing wizard (config/onboarding.js's CATEGORIES),
// so they share a colour and an icon while keeping their own words.

// The colours mirror frontend/src/features/map/hooks/useMapPins.js exactly.
// They are pin identity on both platforms and must not drift apart.
export const TYPE_COLOR = {
  APARTMENT: '#0284C7',
  HOUSE: '#16A34A',
  VILLA: '#16A34A',
  INDEPENDENT_HOUSE: '#16A34A',
  LAND: '#B45309',
  PG: '#7C3AED',
  COMMERCIAL: '#EA580C',
  SHORT_STAY: '#DB2777',
}

// Same six glyphs web inlines as SVG in useMapPins.js — Building2 / House /
// LandPlot / BedDouble / Store / Luggage — here as Icon names.
export const TYPE_ICON = {
  APARTMENT: 'building',
  HOUSE: 'home',
  VILLA: 'home',
  INDEPENDENT_HOUSE: 'home',
  LAND: 'land',
  PG: 'bed',
  COMMERCIAL: 'store',
  SHORT_STAY: 'luggage',
}

// Short enough to sit in a card's meta line. "Plot" and "Stay" are what these
// are called in the wizard and in search, not "Land" and "Short stay".
export const TYPE_LABEL = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  VILLA: 'Villa',
  INDEPENDENT_HOUSE: 'Independent house',
  LAND: 'Plot',
  PG: 'PG',
  COMMERCIAL: 'Commercial',
  SHORT_STAY: 'Stay',
}

// An unknown type falls back to slate rather than the brand colour: brand is
// what the map uses for its OWN chrome (clusters, controls), and a pin wearing
// it reads as a control, not as a property of some type we can't name.
export const UNKNOWN_TYPE_COLOR = '#475569'

export const typeColor = (type) => TYPE_COLOR[type] ?? UNKNOWN_TYPE_COLOR

// null, not 'home' — aligned with web on 2026-08-10. `'home'` is a REAL icon
// name, so a type missing from the table drew a house, and a plot or a shop
// looked like somebody's flat. That is the precise shape of the bug web removed
// when its own PropertyCard fallback silently rendered LAND and SHORT_STAY as
// houses for weeks: a fallback that is itself a valid value HIDES the gap
// instead of showing it.
//
// Safe at the one call site: `Icon` renders nothing for an unknown name
// (components/common/Icon.js), so the pin degrades to its price — which is
// true — rather than to a confident wrong glyph.
//
// typeColor is the deliberate EXCEPTION and stays: slate is not any type's
// colour, so it cannot be mistaken for one. That is what separates an honest
// fallback from a misleading one.
export const typeIcon = (type) => TYPE_ICON[type] ?? null
export const typeLabel = (type) => TYPE_LABEL[type] ?? null

// A deeper shade of the same colour, for a filled surface that has to carry
// white text. Mirrors web's darken() in useMapPins.js: every TYPE_COLOR above
// is between 3.1:1 and 5.9:1 against white — three of the six fail the 4.5:1
// text rule at full strength, and all six pass comfortably at 0.72.
export function darkenHex(hex, factor = 0.72) {
  const n = parseInt(hex.slice(1), 16)
  const channel = (shift) => Math.round(((n >> shift) & 255) * factor)
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}
