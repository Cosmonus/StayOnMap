// POI accuracy as a measurable engineering metric.
//
// The point of this file is that every number below comes from a COUNT, not
// from a claim. "Our POI data is good" is not a statement anyone can check;
// "of 41,206 active POIs in Bengaluru, 3,110 have never been scored and 812 are
// low-confidence" is.
//
// Read-only. Everything here is a groupBy or a count over indexes that already
// exist, and nothing recomputes a score — a dashboard that silently triggered
// the work it reports on would make its own numbers move as you looked at them.
import { prisma } from '../../lib/prisma.js'
import { intelError } from '../../lib/intelLog.js'
import { volatilityFor } from './poiPolicy.js'

// Matching envelope.js's CONFIDENCE_BANDS on the 0-100 scale, so a POI's band
// and a module's confidence band mean the same thing to somebody reading both.
const HIGH_SCORE = 75
const LOW_SCORE = 50

// Rows returned in the review lists. A queue nobody can work through is a
// number, not a queue.
const REVIEW_LIMIT = 50

/** Percentage, or null when the denominator is zero — 0/0 is not 0%. */
function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

/**
 * The headline counts. One pass of cheap aggregates.
 *
 * `unscored` is deliberately its own number rather than folded into the low
 * band. Before the scoring job has run, every row is unscored — and a dashboard
 * that reports that as "0% high confidence" describes a job that has not run as
 * a database full of bad data.
 */
async function totals(where) {
  const [total, absent, unscored, high, low, contradicted, verified, openConflicts] =
    await Promise.all([
      prisma.poiIndex.count({ where }),
      prisma.poiIndex.count({ where: { ...where, status: 'ABSENT_FROM_SOURCE' } }),
      prisma.poiIndex.count({ where: { ...where, trustScore: null } }),
      prisma.poiIndex.count({ where: { ...where, trustScore: { gte: HIGH_SCORE } } }),
      prisma.poiIndex.count({ where: { ...where, trustScore: { lt: LOW_SCORE } } }),
      prisma.poiIndex.count({ where: { ...where, verificationStatus: 'CONTRADICTED' } }),
      prisma.poiIndex.count({ where: { ...where, verificationStatus: 'CROSS_CHECKED' } }),
      prisma.poiConflict.count({ where: { status: 'OPEN' } }),
    ])

  const scored = total - unscored
  return {
    total,
    active: total - absent,
    absent,
    unscored,
    scored,
    highConfidence: high,
    lowConfidence: low,
    // Quoted against SCORED rows, not against everything. A rate whose
    // denominator includes rows that were never measured is not a quality
    // rate — it is a progress bar wearing one.
    highConfidencePct: pct(high, scored),
    lowConfidencePct: pct(low, scored),
    verified,
    contradicted,
    verifiedPct: pct(verified, total),
    openConflicts,
  }
}

/**
 * Freshness by category — which parts of the map are overdue for a re-fetch.
 *
 * Compared against each category's OWN refresh cadence (poiPolicy.js), not one
 * global age. A metro station fetched 200 days ago is fine; a salon fetched 200
 * days ago is probably fiction, and a single "average age" column reports the
 * two identically.
 */
async function freshnessByCategory(where, now) {
  const rows = await prisma.poiIndex.groupBy({
    by: ['category'],
    where: { ...where, status: 'ACTIVE' },
    _count: { _all: true },
    _min: { fetchedAt: true },
    _max: { fetchedAt: true },
  })

  return rows
    .map((r) => {
      const oldest = r._min.fetchedAt
      const ageDays = oldest
        ? Math.floor((now.getTime() - new Date(oldest).getTime()) / 86_400_000)
        : null
      const { refreshDays } = volatilityFor(r.category)
      return {
        category: r.category,
        count: r._count._all,
        oldestFetchDays: ageDays,
        refreshDays,
        // The only judgement in this file, and it is arithmetic: is the oldest
        // row past the cadence this category declares for itself?
        overdue: ageDays != null && ageDays > refreshDays,
      }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Conflict rate by attribute — which of our rules is arguing with the source
 * most, which is what eventually replaces poiPolicy.js's guessed thresholds
 * with measured ones.
 */
async function conflictsByAttribute() {
  const rows = await prisma.poiConflict.groupBy({
    by: ['attribute', 'status'],
    _count: { _all: true },
  })
  const out = {}
  for (const r of rows) {
    const acc = (out[r.attribute] ??= { total: 0, open: 0, withheld: 0 })
    acc.total += r._count._all
    if (r.status === 'OPEN') acc.open += r._count._all
  }
  // Withheld is its own query: it is a property of the ROW, not of its status,
  // and it is the one that means "we are knowingly serving something the source
  // disputes" — the sharpest signal in this table.
  const withheld = await prisma.poiConflict.groupBy({
    by: ['attribute'],
    where: { applied: false },
    _count: { _all: true },
  })
  for (const r of withheld) {
    (out[r.attribute] ??= { total: 0, open: 0, withheld: 0 }).withheld = r._count._all
  }
  return out
}

/** Churn: what opened and closed, from the append-only history. */
async function churn(since) {
  const rows = await prisma.poiStatusEvent.groupBy({
    by: ['toStatus'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  })
  const by = Object.fromEntries(rows.map((r) => [r.toStatus, r._count._all]))
  return {
    since: since.toISOString(),
    // Never summed into a single "churn" figure. A place disappearing and a
    // place returning are opposite events with opposite causes, and one number
    // covering both is the "net supply" mistake PropertyStatusEvent exists to
    // avoid, repeated.
    wentAbsent: by.ABSENT_FROM_SOURCE ?? 0,
    returned: by.ACTIVE ?? 0,
  }
}

/**
 * Everything the admin panel needs, in one call.
 *
 * @param {{city?: string, now?: Date, churnDays?: number}} [opts]
 */
export async function getPoiQuality({ city = null, now = new Date(), churnDays = 90 } = {}) {
  const where = city ? { city } : {}
  try {
    const [headline, freshness, conflicts, recentChurn, byCity, needsReview] = await Promise.all([
      totals(where),
      freshnessByCategory(where, now),
      conflictsByAttribute(),
      churn(new Date(now.getTime() - churnDays * 86_400_000)),
      // Always whole-population, even when the caller scoped to one city: the
      // question this answers is "which city should we work on", and it cannot
      // be answered from inside one of them.
      prisma.poiIndex.groupBy({
        by: ['city'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
        _avg: { trustScore: true },
      }),
      // The actual work queue, not just its size.
      prisma.poiIndex.findMany({
        where: {
          ...where,
          status: 'ACTIVE',
          OR: [{ verificationStatus: 'CONTRADICTED' }, { trustScore: { lt: LOW_SCORE } }],
        },
        select: {
          id: true, osmId: true, name: true, category: true, city: true,
          trustScore: true, verificationStatus: true, trustReasons: true,
        },
        orderBy: [{ trustScore: 'asc' }],
        take: REVIEW_LIMIT,
      }),
    ])

    return {
      city,
      headline,
      freshness,
      conflicts,
      churn: recentChurn,
      byCity: byCity
        .map((r) => ({
          city: r.city,
          active: r._count._all,
          // An average IS the wrong summary for a single POI's trust (see
          // poiShadow.js) and the right one for comparing cities, because the
          // question here is comparative rather than about any one place.
          // Rounded to a whole number: the input is integers and a decimal
          // would imply a precision the score does not have.
          avgTrust: r._avg?.trustScore == null ? null : Math.round(r._avg.trustScore),
        }))
        .sort((a, b) => b.active - a.active),
      needsReview,
      thresholds: { high: HIGH_SCORE, low: LOW_SCORE },
    }
  } catch (err) {
    intelError('spatial.poi_quality_failed', err, { city })
    // A dashboard failing must not 500 the admin panel around it. Null reads as
    // "we could not measure this", which the card renders as such — distinct
    // from zero, which would read as "there is nothing here".
    return null
  }
}
