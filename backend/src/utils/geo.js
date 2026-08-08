// Geo helpers for bounding box queries
import { z } from 'zod'

/**
 * The one India bounding box.
 *
 * THE ONE. This constant already lived here and was then written out as four
 * bare literals in three other files — `graph/tools.js`,
 * `properties.validation.js` (twice) and `metro-validation/constants.js` — none
 * of which imported it. Four numbers copied seven times is not a risk today;
 * it becomes one the day the platform operates anywhere else, when "widen the
 * bounds" turns into "find every place someone typed 38".
 *
 * Anything outside it cannot be a real Indian address, so it is only ever a
 * typo or an attempt to bust a coordinate-keyed cache.
 *
 * `tests/india-bounds-single-source.test.js` fails the build if an eighth copy
 * appears.
 */
export const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 }

/**
 * The same box as Zod, for the validation layers.
 *
 * Takes the base schema because the callers genuinely differ and the difference
 * matters: a JSON body carries a real number (`z.number()`), while a query
 * string carries "12.99" and needs `z.coerce.number()`. Passing the base in
 * keeps one definition of the BOUNDS without pretending the two callers have
 * the same input.
 */
export const indiaLat = (base = z.number()) => base.min(INDIA_BOUNDS.minLat).max(INDIA_BOUNDS.maxLat)
export const indiaLng = (base = z.number()) => base.min(INDIA_BOUNDS.minLng).max(INDIA_BOUNDS.maxLng)

export function isWithinIndia(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng
  )
}

export function parseBounds(query) {
  const { swLat, swLng, neLat, neLng } = query
  return {
    swLat: parseFloat(swLat),
    swLng: parseFloat(swLng),
    neLat: parseFloat(neLat),
    neLng: parseFloat(neLng),
  }
}

export function boundsFilter(bounds) {
  return {
    lat: { gte: bounds.swLat, lte: bounds.neLat },
    lng: { gte: bounds.swLng, lte: bounds.neLng },
  }
}
