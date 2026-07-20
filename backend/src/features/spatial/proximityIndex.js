// Proximity as a FILTERABLE fact, not just a readable one.
//
// The spatial layer already knows what is near a cell — but it knows it as JSON
// inside a module envelope. JSON reads whole and filters not at all, so "show me
// flats within 800 m of a metro" has been impossible at any price, while the
// data to answer it sat in the database the whole time.
//
// docs/spatial-intelligence.md names the trigger for promoting a value out of
// that JSON into a real column: when a FILTER needs it, not before. This is that
// moment, and this module is the promotion — nothing more. It does not replace
// the envelopes, it summarises them into the two or three numbers a WHERE clause
// can use.
//
// Deliberately NOT a `Place` table with match rules. Entity resolution exists to
// reconcile the same hospital across OSM, Overture and a government list; there
// is one source today, so `PoiIndex.osmId` already IS the canonical key. Adding
// match rules now would be machinery for a problem that has not arrived — see
// todo.md Phase 5 for the resequencing and the condition that would change it.
import { prisma } from '../../lib/prisma.js'
import { intelError } from '../../lib/intelLog.js'
import { poisNear } from './poiProvider.js'

// The two radii a filter actually asks about. 800 m is the widely-used
// "10-15 minute walk"; 1600 m is the outer edge of where people walk at all.
// Both are already the vocabulary lifestyle.module.js uses, so a filter and a
// card cannot disagree about what "walkable" means.
const NEAR_M = 800
const REACH_M = 1600

/**
 * The categories worth spending a filter on.
 *
 * A deliberate subset of CATEGORY_KEYS, not all 26. Every category here costs a
 * row per cell and a line of UI, and most of the vocabulary answers a question
 * nobody filters by — a renter picks a home near a school or a station, not near
 * a laundry. Adding one is a one-line change plus a recompute; adding all of
 * them would be twenty-six filters nobody asked for and a table five times
 * larger for it.
 */
export const FILTERABLE_POI_CATEGORIES = [
  'railway_station', // metro and rail — the one people actually plan around
  'bus_stop',
  'school',
  'hospital',
  'supermarket',
  'park',
]

/**
 * Recompute the proximity summary for one cell.
 *
 * Called from the same place that materialises a cell, so the summary can never
 * describe a different moment than the envelopes do. Never throws: proximity is
 * an optimisation over data that already exists, and a filter index failing to
 * write must not take a cell's materialisation down with it.
 *
 * @param {string} geohash
 * @param {{lat: number, lng: number, city: string|null}} cell
 * @param {string[]} categories  which POI categories to summarise
 * @returns {Promise<number>} how many category rows were written
 */
export async function refreshCellProximity(geohash, cell, categories) {
  if (!geohash || !cell || !categories?.length) return 0

  try {
    const result = await poisNear(cell.lat, cell.lng, REACH_M, categories, cell.city)
    // `available: false` means the city was never seeded. Writing zeroes here
    // would turn "we have not loaded this" into "there is nothing here" — the
    // single confusion this whole layer exists to prevent, and it would be
    // baked into a filter where nobody would ever see the caveat.
    if (!result?.available) return 0

    const rows = categories.map((category) => {
      const hits = result.byCategory[category] ?? []
      return {
        geohash,
        category,
        nearestM: hits.length ? Math.round(hits[0].distanceM) : null,
        count800M: hits.filter((h) => h.distanceM <= NEAR_M).length,
        count1600M: hits.length,
      }
    })

    // Sequential upserts rather than createMany: this runs once per cell
    // materialisation over a handful of categories, and an upsert keeps a
    // recompute idempotent instead of accumulating duplicate rows.
    for (const row of rows) {
      await prisma.cellPoiSummary.upsert({
        where: { geohash_category: { geohash: row.geohash, category: row.category } },
        update: { ...row, computedAt: new Date() },
        create: row,
      })
    }

    return rows.length
  } catch (err) {
    intelError('spatial.proximity_index_failed', err, { geohash })
    return 0
  }
}

/**
 * Cells within `metres` of `category`.
 *
 * Returns the cell list rather than a Prisma `where` fragment, because the
 * lookup is asynchronous and the filter registry builds its `where` object
 * synchronously — a fragment holding a promise would be accepted by nothing and
 * fail at query time rather than here.
 *
 * The caller filters on Property.geohash, its only link to the spatial layer.
 * A property with no geohash is therefore excluded rather than included: an
 * un-backfilled row is of UNKNOWN proximity, and returning it as a match would
 * put a listing 5 km from a metro in a "near metro" result set.
 *
 * Capped: a predicate matching most of a city is not a filter anyone meant to
 * apply, and an unbounded `IN` list is a slow query pretending to be a feature.
 */
export async function cellsNear(category, metres, cap = 20_000) {
  const rows = await prisma.cellPoiSummary.findMany({
    where: { category, nearestM: { not: null, lte: metres } },
    select: { geohash: true },
    take: cap,
  })
  return rows.map((r) => r.geohash)
}
