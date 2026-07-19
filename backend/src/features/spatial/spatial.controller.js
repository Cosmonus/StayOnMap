import { ok } from '../../utils/response.js'
import { isWithinIndia } from '../../utils/geo.js'
import * as service from './spatial.service.js'
import { listPoisNear } from './poiProvider.js'
import { CATEGORY_KEYS } from './poiCategories.js'
import { walkMinutes, WALK_METHOD, MAX_WALK_PHRASE_M } from './proximity.js'
import { openState } from './openingHours.js'
import { resolveCity } from '../../config/cityCenters.js'

// The detail lists cover "what a person would go to from home" distances.
// Wider than 5 km stops being a neighbourhood question, and the arrival-scale
// categories (airports) already have their own module facts.
const MIN_RADIUS_M = 100
const MAX_RADIUS_M = 5000
const DEFAULT_RADIUS_M = 2000

export async function contextAt(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat)
    const lng = parseFloat(req.query.lng)

    // Same guard as places.controller.js: an out-of-range coordinate is a
    // guaranteed cache miss, and a miss here schedules billed work.
    if (!isWithinIndia(lat, lng)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'lat and lng are required and must be within India',
        statusCode: 400,
      })
    }

    const context = await service.getContext(lat, lng)

    // null means the cell is being computed for the first time. 200 with a
    // null payload, not 404 — the location exists, we just don't know it yet,
    // and the client renders nothing rather than an error.
    ok(res, context)
  } catch (err) { next(err) }
}

/**
 * GET /api/v1/spatial/pois?lat=&lng=&category=bank,atm&radius=2000
 *
 * The named places behind a module's counts — "which banks", not "how many".
 * Fetched once per category by the client, searched locally there; nothing
 * about this endpoint is metered (PoiIndex only, one indexed bbox scan).
 */
export async function poisNear(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat)
    const lng = parseFloat(req.query.lng)

    if (!isWithinIndia(lat, lng)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'lat and lng are required and must be within India',
        statusCode: 400,
      })
    }

    const categories = String(req.query.category ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    const unknown = categories.filter((c) => !CATEGORY_KEYS.includes(c))
    if (categories.length === 0 || unknown.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: unknown.length
          ? `Unknown category: ${unknown.join(', ')}`
          : 'category is required (comma-separated)',
        statusCode: 400,
      })
    }

    const radiusM = Math.min(
      MAX_RADIUS_M,
      Math.max(MIN_RADIUS_M, parseInt(req.query.radius, 10) || DEFAULT_RADIUS_M)
    )

    const city = resolveCity(lat, lng)?.city ?? null
    const result = await listPoisNear(lat, lng, categories, radiusM, city)

    ok(res, {
      // false = the city isn't seeded. The client must say "data not loaded",
      // never "nothing here" — those are different claims.
      available: result.available,
      categories,
      radiusM,
      total: result.total,
      truncated: result.truncated,
      // Disclosed once for the whole list rather than repeated per row.
      walkMethod: WALK_METHOD,
      pois: result.pois.map((p) => ({
        ...p,
        // Estimated, and only where calling it a walk is honest.
        walkMinutes: p.distanceM <= MAX_WALK_PHRASE_M ? walkMinutes(p.distanceM) : null,
        // 'open' | 'closed' | null. null means the hours are absent or in a
        // form we won't guess at — the client renders that as unknown, never
        // as closed. Deliberately NOT used to sort or filter: OSM hours
        // coverage in India is thin, so ranking on it would bury well-mapped
        // places beneath unmapped ones for no reason a user would accept.
        openState: openState(p.openingHours),
      })),
    })
  } catch (err) { next(err) }
}
