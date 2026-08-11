// The database side of POI trust: find what needs scoring, gather the evidence,
// write the result.
//
// Everything that DECIDES anything lives in poiTrust.js and is pure. This file
// only fetches and persists, which is why it can be read quickly and why the
// interesting rules are testable without a database.
//
// It runs in the BACKGROUND, never on a request path. Scoring reads conflict
// history and status history per POI; doing that while somebody waits for a map
// to draw would be the exact online/offline confusion the spatial layer was
// built to avoid (docs/spatial-intelligence.md §1).
import { prisma } from '../../lib/prisma.js'
import { intelLog, intelError } from '../../lib/intelLog.js'
import { env } from '../../config/env.js'
import { STATE_OF_CITY } from '../../config/cities.js'
import { poiTrustScore, verifyByPincode } from './poiTrust.js'

// How many POIs one pass scores. Small enough that a tick is short and a
// failure costs little; the job runs often, so throughput comes from frequency
// rather than from one enormous batch.
const BATCH = 500

// Concurrent writes. Same reasoning and same number as the seeder's: enough to
// pipeline, not enough to exhaust a connection pool the API is also using.
const WRITE_CONCURRENCY = 25

// A score goes stale even when nothing about the POI changes, because freshness
// decays with the calendar. Monthly is finer than the decay curve can actually
// resolve, so re-scoring more often would only burn writes.
const SCORE_TTL_DAYS = 30

/**
 * POIs whose score is missing, older than their data, or simply old.
 *
 * The three conditions are genuinely different and all three matter:
 *   scoredAt IS NULL   — never scored (every row, before the first run)
 *   scoredAt < fetchedAt — the data moved under the score
 *   scoredAt < cutoff  — nothing changed, but time passed
 */
async function findWork(city, limit, now) {
  const cutoff = new Date(now.getTime() - SCORE_TTL_DAYS * 24 * 60 * 60 * 1000)
  return prisma.poiIndex.findMany({
    where: {
      ...(city ? { city } : {}),
      OR: [{ scoredAt: null }, { scoredAt: { lt: cutoff } }],
    },
    // Nulls first, then least-recently-scored. Postgres sorts NULLs last on
    // ASC by default, so this is written explicitly rather than relied upon —
    // getting it wrong means the never-scored rows are scored last, which is
    // precisely backwards.
    orderBy: [{ scoredAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
    select: {
      id: true, osmId: true, category: true, name: true, brand: true,
      openingHours: true, phone: true, website: true, address: true,
      postcode: true, lat: true, lng: true, city: true, status: true,
      fetchedAt: true, verificationStatus: true, verificationMethod: true,
    },
  })
}

/**
 * Everything the pure scorer needs, gathered in four queries rather than four
 * per POI. At 500 rows a per-POI lookup would be 2,000 round trips.
 */
async function gatherEvidence(pois) {
  const ids = pois.map((p) => p.id)
  const postcodes = [...new Set(pois.map((p) => p.postcode).filter(Boolean))]

  const [conflictGroups, withheld, eventGroups, directory] = await Promise.all([
    // How often each POI's attributes have been disputed. SUPERSEDED rows are
    // counted too, deliberately: a place whose position has been argued over
    // four times is unsettled whether or not the older rows were retired.
    prisma.poiConflict.groupBy({
      by: ['poiIndexId', 'attribute'],
      where: { poiIndexId: { in: ids } },
      _count: { _all: true },
    }),
    // Are we currently serving a coordinate the source contradicts? Only an
    // OPEN row counts — a resolved one has been adjudicated.
    prisma.poiConflict.findMany({
      where: { poiIndexId: { in: ids }, attribute: 'location', applied: false, status: 'OPEN' },
      select: { poiIndexId: true },
    }),
    // Appearing and disappearing repeatedly is its own signal.
    prisma.poiStatusEvent.groupBy({
      by: ['poiIndexId'],
      where: { poiIndexId: { in: ids } },
      _count: { _all: true },
    }),
    postcodes.length
      ? prisma.pincodeDirectory.findMany({
        where: { pincode: { in: postcodes } },
        select: { pincode: true, state: true },
      })
      : [],
  ])

  const conflictCounts = new Map()
  for (const g of conflictGroups) {
    if (!conflictCounts.has(g.poiIndexId)) conflictCounts.set(g.poiIndexId, {})
    conflictCounts.get(g.poiIndexId)[g.attribute] = g._count._all
  }

  const byPincode = new Map()
  for (const row of directory) {
    if (!byPincode.has(row.pincode)) byPincode.set(row.pincode, [])
    byPincode.get(row.pincode).push(row)
  }

  return {
    conflictCounts,
    withheldIds: new Set(withheld.map((r) => r.poiIndexId)),
    eventCounts: new Map(eventGroups.map((g) => [g.poiIndexId, g._count._all])),
    byPincode,
  }
}

/**
 * Score one batch of POIs.
 *
 * @param {{city?: string, limit?: number, now?: Date, dryRun?: boolean}} [opts]
 * @returns {Promise<{scored: number, verified: number, contradicted: number, remaining: boolean}>}
 */
export async function scorePoiBatch({ city = null, limit = BATCH, now = new Date(), dryRun = false } = {}) {
  const empty = { scored: 0, verified: 0, contradicted: 0, remaining: false }
  try {
    const pois = await findWork(city, limit, now)
    if (!pois.length) return empty

    const evidence = await gatherEvidence(pois)
    let verified = 0
    let contradicted = 0

    const updates = pois.map((poi) => {
      // Verification first — its result feeds the score.
      const check = verifyByPincode(
        poi.postcode,
        evidence.byPincode.get(poi.postcode) ?? [],
        STATE_OF_CITY[poi.city] ?? null
      )
      if (check.status === 'CROSS_CHECKED') verified++
      if (check.status === 'CONTRADICTED') contradicted++

      const trust = poiTrustScore(
        { ...poi, verificationStatus: check.status, verificationMethod: check.method },
        {
          source: 'osm',
          conflictCounts: evidence.conflictCounts.get(poi.id) ?? {},
          locationWithheld: evidence.withheldIds.has(poi.id),
          statusEventCount: evidence.eventCounts.get(poi.id) ?? 0,
          now,
        }
      )

      return {
        id: poi.id,
        data: {
          trustScore: trust.score,
          // Stored as data, not prose: the band and completeness are read by
          // the dashboard, and re-deriving them from the reasons array would
          // mean parsing sentences.
          trustReasons: { band: trust.band, completeness: trust.completeness, reasons: trust.reasons },
          confidence: Object.fromEntries(
            Object.entries(trust.attributes).map(([k, v]) => [k, { value: v.value, band: v.band, present: v.present, basis: v.basis }])
          ),
          scoredAt: now,
          verificationStatus: check.status,
          verificationMethod: check.method,
          // Only stamped when something actually did the checking. An
          // UNVERIFIED row keeps a null date rather than recording the moment
          // we declined to check it, which would read as a verification.
          ...(check.method ? { verifiedAt: now } : {}),
        },
      }
    })

    if (!dryRun) {
      for (let i = 0; i < updates.length; i += WRITE_CONCURRENCY) {
        await Promise.all(updates.slice(i, i + WRITE_CONCURRENCY).map((u) =>
          prisma.poiIndex.update({ where: { id: u.id }, data: u.data })
        ))
      }
    }

    intelLog('spatial.poi_scored', { city, scored: updates.length, verified, contradicted, dryRun })
    return {
      scored: updates.length, verified, contradicted,
      // A full batch means there is probably more. Lets a caller loop without
      // re-querying, and lets the job know it should run again soon.
      remaining: pois.length === limit,
    }
  } catch (err) {
    intelError('spatial.poi_scoring_failed', err, { city })
    return empty
  }
}

/**
 * Score every outstanding POI, batch after batch.
 *
 * Bounded by `maxBatches` rather than running to exhaustion: this is called
 * from a scheduled job, and a tick that never ends is a tick that overlaps the
 * next one. What it does not finish, the next tick picks up — the work queue is
 * a column, so progress is durable with no state held anywhere.
 */
/**
 * One scheduled pass, gated on POI_INTELLIGENCE_ENABLED.
 *
 * Deliberately shares the spatial refresher's existing pg-boss schedule rather
 * than adding a queue, a cron entry or a worker process. The work is one bounded
 * batch every five minutes: at 500 rows a tick a 200k-POI city is fully scored
 * in about a day and a half of background time, which is the right pace for a
 * number that only decays monthly.
 *
 * ONE batch per tick, not scoreAllPois. A tick that keeps going until the queue
 * is empty is a tick that overlaps the next one, and the cell refresher shares
 * this schedule — starving it would trade a visible feature for a background
 * one. The work queue is a column, so progress is durable and the next tick
 * simply continues.
 *
 * @returns {Promise<{skipped: boolean, scored?: number}>}
 */
export async function runPoiScoringTick(now = new Date()) {
  if (!env.poiIntelligenceEnabled) return { skipped: true }
  const result = await scorePoiBatch({ now })
  return { skipped: false, ...result }
}

export async function scoreAllPois({ city = null, maxBatches = 20, now = new Date() } = {}) {
  const total = { scored: 0, verified: 0, contradicted: 0, batches: 0 }
  for (let i = 0; i < maxBatches; i++) {
    const result = await scorePoiBatch({ city, now })
    total.scored += result.scored
    total.verified += result.verified
    total.contradicted += result.contradicted
    total.batches++
    if (!result.remaining) break
  }
  return total
}
