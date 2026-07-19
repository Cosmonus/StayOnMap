// What a POI re-seed must do BEYOND writing rows.
//
// Lives in src/ rather than inline in scripts/fetch-osm-pois.mjs so it can be
// tested: the two operations here are the difference between a re-seed that
// reaches users and one that sits behind a 60-day TTL, and both were shipped
// untested the first time.
import { prisma } from '../../lib/prisma.js'
import { cacheDel } from '../../lib/redis.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

/**
 * Delete this city's POIs that the current fetch did not return.
 *
 * A POI removed from OpenStreetMap — demolished, retagged out of our
 * vocabulary, or re-mapped from a node to a way (which changes its osmId) —
 * otherwise persists forever, because the seed only ever upserts what it
 * finds. That is where "places that no longer exist" came from.
 *
 * ONLY safe after a fully-successful fetch. With a failed tile, the rows that
 * tile would have refreshed are indistinguishable from genuine ghosts, and
 * deleting real coverage is far worse than keeping a stale row for one cycle.
 * The caller owns that decision; this function refuses to guess.
 *
 * @param {string} city
 * @param {Date} before  the run's start time — rows older than this were not
 *                       touched by the run and are therefore absent from OSM
 * @returns {Promise<number>} rows deleted
 */
export async function removeStalePois(city, before) {
  try {
    const { count } = await prisma.poiIndex.deleteMany({
      where: { city, fetchedAt: { lt: before } },
    })
    if (count) intelLog('spatial.stale_pois_removed', { city, count })
    return count
  } catch (err) {
    intelError('spatial.stale_poi_removal_failed', err, { city })
    return 0
  }
}

/**
 * Mark every computed cell in a city stale and drop its coverage caches.
 *
 * Without this a re-seed changes nothing a user can see: cells key their
 * recomputation on `staleAfter` and module `version` only, and the POI-driven
 * modules carry TTLs of 14-60 days. The refresher picks the cells up on its
 * next ticks (stalest first), so this spreads the recompute out rather than
 * doing it here.
 *
 * @returns {Promise<number>} cells marked stale
 */
export async function invalidateCityCells(city, when = new Date()) {
  let count = 0
  try {
    const res = await prisma.spatialContext.updateMany({
      where: { city },
      data: { staleAfter: when },
    })
    count = res.count
    if (count) intelLog('spatial.cells_invalidated', { city, count })
  } catch (err) {
    intelError('spatial.cell_invalidation_failed', err, { city })
  }

  // Cached for an hour each, so without busting them a freshly-seeded city
  // keeps reading as "not loaded for this city" well after the data landed.
  for (const key of [`spatial:poicov:${city}`, `spatial:poicat:${city}`, `spatial:poifresh:${city}`]) {
    try {
      await cacheDel(key)
    } catch (err) {
      intelError('spatial.coverage_cache_bust_failed', err, { city, key })
    }
  }

  return count
}
