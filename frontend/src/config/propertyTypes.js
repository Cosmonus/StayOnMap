// How each PropertyType presents itself on web: its word and its icon.
//
// The mirror of mobile/src/config/propertyTypes.js — same words, same glyphs,
// same eight enum values. Mobile also carries the pin COLOURS, which on web
// live in features/map/hooks/useMapPins.js because that file inlines them into
// SVG; the labels and icons are what kept drifting, so they are what moved
// here.
//
// It was three tables before this, and they disagreed:
//   PropertyPopup.jsx  — all 8, "Plot" and "Stay"
//   PropertyCard.jsx   — 6, MISSING LAND and SHORT_STAY entirely
//   SavedHomes.jsx     — no type at all, only furnishing
// A plot in the browse grid therefore showed no type: `TYPE_LABEL[type]` was
// undefined and `.filter(Boolean)` swallowed it, so the bug looked like a
// design choice. Mobile hit the same class of bug on the map — see
// mobile/src/config/propertyTypes.test.js.
import { Building2, Home, LandPlot, BedDouble, Store, Luggage } from 'lucide-react'

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

// The same six glyphs useMapPins.js inlines as SVG for the pins themselves —
// HOUSE / VILLA / INDEPENDENT_HOUSE are one wizard category and share one.
export const TYPE_ICON = {
  APARTMENT: Building2,
  HOUSE: Home,
  VILLA: Home,
  INDEPENDENT_HOUSE: Home,
  LAND: LandPlot,
  PG: BedDouble,
  COMMERCIAL: Store,
  SHORT_STAY: Luggage,
}

// Both accessors return null for an unknown type rather than a real-looking
// default. A `?? Home` fallback is what let two missing categories render as
// houses for weeks: a fallback that is itself a valid value HIDES the gap
// instead of showing it. Callers that must draw something choose their own
// default at the call site, where it is visible.
export const typeLabel = (type) => TYPE_LABEL[type] ?? null
export const typeIcon = (type) => TYPE_ICON[type] ?? null

export const FURNISHED_LABEL = {
  FULLY: 'Furnished',
  SEMI: 'Semi furnished',
  UNFURNISHED: 'Unfurnished',
}

export const furnishedLabel = (f) => FURNISHED_LABEL[f] ?? null
