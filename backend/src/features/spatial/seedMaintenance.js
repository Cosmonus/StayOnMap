// What a POI re-seed must do BEYOND writing rows.
//
// Lives in src/ rather than inline in scripts/fetch-osm-pois.mjs so it can be
// tested: the two operations here are the difference between a re-seed that
// reaches users and one that sits behind a 60-day TTL, and both were shipped
// untested the first time.
import { prisma } from '../../lib/prisma.js'
import { cacheDel } from '../../lib/redis.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

// Cells rewritten per round of invalidation. Bengaluru alone can hold thousands.
const INVALIDATE_BATCH = 50

// Status events written per round. A full Delhi re-seed can move thousands of
// rows at once and one createMany of that size is a statement nobody wants to
// see time out at the end of a two-hour fetch.
const EVENT_BATCH = 500

/**
 * Write the append-only record of a status transition.
 *
 * Never throws, and never blocks the transition it describes: the status change
 * is the operational fact, the event is the history. Losing an event is bad;
 * refusing to mark a POI absent because its event row would not insert is worse.
 */
async function recordStatusEvents(rows, fromStatus, toStatus, reason) {
  if (!rows.length) return
  try {
    for (let i = 0; i < rows.length; i += EVENT_BATCH) {
      await prisma.poiStatusEvent.createMany({
        data: rows.slice(i, i + EVENT_BATCH).map((r) => ({
          poiIndexId: r.id, fromStatus, toStatus, reason,
        })),
      })
    }
  } catch (err) {
    intelError('spatial.poi_status_event_failed', err, { toStatus, count: rows.length })
  }
}

/**
 * Mark this city's POIs that the current fetch did not return as absent.
 *
 * Replaced a hard DELETE on 2026-08-11, and the deletion is the thing worth
 * describing. A POI that leaves OpenStreetMap — demolished, retagged out of our
 * vocabulary, or re-mapped from a node to a way, which changes its osmId — used
 * to be removed outright. That made "which places near this listing closed last
 * year" unanswerable from our own data at any price and for all time: deletion
 * is the one data loss no later work can repair.
 *
 * Nothing user-facing changes. poiProvider.js filters `status: ACTIVE`, so an
 * absent row is exactly as invisible as a deleted one was. It is simply still
 * there to count, and the transition is now in PoiStatusEvent.
 *
 * ABSENT_FROM_SOURCE is deliberately not "closed". The absence is observed; the
 * reason is not, and the four candidate reasons look identical from here.
 *
 * ONLY safe after a fully-successful fetch. With a failed tile, the rows that
 * tile would have refreshed are indistinguishable from genuine ghosts. That was
 * true when this deleted and it stays true — marking every POI in a district
 * absent because Overpass timed out would empty real cards. The caller owns
 * that decision; this function refuses to guess.
 *
 * @param {string} city
 * @param {Date} before  the run's start time — rows older than this were not
 *                       touched by the run and are therefore absent from OSM
 * @returns {Promise<number>} rows marked absent
 */
export async function markAbsentPois(city, before) {
  try {
    // Read the ids first: updateMany returns a count, not the rows, and the
    // history needs to name them. Already-absent rows are excluded by the
    // status predicate, so a second consecutive re-seed writes no duplicate
    // events for a place that has simply stayed gone.
    const stale = await prisma.poiIndex.findMany({
      where: { city, status: 'ACTIVE', fetchedAt: { lt: before } },
      select: { id: true },
    })
    if (!stale.length) return 0

    const reason = `not returned by the ${before.toISOString().slice(0, 10)} ${city} fetch`

    const { count } = await prisma.poiIndex.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: {
        status: 'ABSENT_FROM_SOURCE',
        statusReason: reason,
        statusChangedAt: before,
      },
    })

    await recordStatusEvents(stale, 'ACTIVE', 'ABSENT_FROM_SOURCE', reason)

    if (count) intelLog('spatial.pois_marked_absent', { city, count })
    return count
  } catch (err) {
    intelError('spatial.poi_absence_marking_failed', err, { city })
    return 0
  }
}

/**
 * Bring back POIs that this fetch returned and that were previously absent.
 *
 * The other half of the lifecycle, and the reason the history is worth keeping
 * at all. A place vanishing and returning is routine in OpenStreetMap — one
 * mapper retags a node, another reverts it a week later — and without this the
 * row would sit ABSENT_FROM_SOURCE forever while the source plainly says it is
 * there, which is a worse error than the deletion this replaced.
 *
 * Set-based rather than per-row inside the upsert loop, and symmetric with
 * markAbsentPois: the upsert has already stamped `fetchedAt`, so "absent, but
 * touched by this run" is exactly the set that came back.
 *
 * @param {string} city
 * @param {Date} since  the run's start time
 * @returns {Promise<number>} rows revived
 */
export async function reviveReturnedPois(city, since) {
  try {
    const returned = await prisma.poiIndex.findMany({
      where: { city, status: 'ABSENT_FROM_SOURCE', fetchedAt: { gte: since } },
      select: { id: true },
    })
    if (!returned.length) return 0

    const reason = `returned in the ${since.toISOString().slice(0, 10)} ${city} fetch`

    const { count } = await prisma.poiIndex.updateMany({
      where: { id: { in: returned.map((r) => r.id) } },
      data: { status: 'ACTIVE', statusReason: reason, statusChangedAt: since },
    })

    await recordStatusEvents(returned, 'ABSENT_FROM_SOURCE', 'ACTIVE', reason)

    if (count) intelLog('spatial.pois_revived', { city, count })
    return count
  } catch (err) {
    intelError('spatial.poi_revival_failed', err, { city })
    return 0
  }
}

/** Expire every envelope in a cell's `modules` JSON, keeping the facts intact. */
function expireEnvelopes(modules, iso) {
  if (!modules || typeof modules !== 'object') return modules
  return Object.fromEntries(Object.entries(modules).map(([slot, envelope]) => [
    slot,
    envelope && typeof envelope === 'object' ? { ...envelope, staleAfter: iso } : envelope,
  ]))
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
 * Staleness lives at TWO levels and both must be cleared. Setting only the
 * ROW's `staleAfter` — which is all this did until 2026-07-20 — schedules a
 * recompute that then reuses every envelope, because computeModules() tests
 * each module against ITS OWN `staleAfter` (spatial.service.js's isStale).
 * The net effect was that re-seeding a city changed nothing for up to 90 days
 * — precisely the outcome the paragraph above says this function exists to
 * prevent. Found by diagnose-spatial.mjs: locality had facts for 4 of 13 cells
 * hours after a full boundary seed, because the other 9 were reusing envelopes
 * computed while the Boundary table was still empty.
 *
 * Envelopes are expired, not deleted: a stale cell still renders (with its own
 * computedAt on show) while the refresher catches up, which is the behaviour
 * everywhere else in this layer.
 *
 * @returns {Promise<number>} cells marked stale
 */
export async function invalidateCityCells(city, when = new Date()) {
  let count = 0
  try {
    // Read-modify-write per row rather than one updateMany, because expiring
    // the envelopes means rewriting a JSON column per cell. Batched so a large
    // city doesn't open thousands of concurrent statements.
    const cells = await prisma.spatialContext.findMany({
      where: { city },
      select: { id: true, modules: true },
    })
    const iso = when.toISOString()

    for (let i = 0; i < cells.length; i += INVALIDATE_BATCH) {
      const batch = cells.slice(i, i + INVALIDATE_BATCH)
      await Promise.all(batch.map((cell) => prisma.spatialContext.update({
        where: { id: cell.id },
        data: { staleAfter: when, modules: expireEnvelopes(cell.modules, iso) },
      })))
      count += batch.length
    }

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
