// What an ETL run records about itself.
//
// Every seeder in scripts/ writes one row per run through here. Lives in src/
// rather than inline in a script for the same reason seedMaintenance.js does:
// it is testable here and it is not there, and the thing being recorded — did
// this run actually cover what it claimed to — is exactly the kind of fact
// that fails silently when it is only a console.log.
//
// The rule this encodes: a run that knew it was incomplete says so in a
// column, not in prose. `complete: false` is what lets a later reader tell
// "this area is genuinely sparse" apart from "we failed to fetch it", which is
// the same distinction every module's `missing[]` field exists to preserve.
import { prisma } from '../../lib/prisma.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

/**
 * Share of rows carrying the fields that make a row useful, as a percentage.
 *
 * Deliberately not "share of non-null columns": most columns are optional by
 * design (a POI's opening hours are usually unmapped, and that is normal, not
 * a defect). Only the caller knows which fields are load-bearing.
 *
 * @param {Array<object>} rows
 * @param {string[]} criticalFields  fields a usable row must have
 * @returns {number|null} 0-100, or null for an empty set — 100% of nothing is
 *                        not a quality signal, it is a division by zero
 */
export function completeness(rows, criticalFields) {
  if (!rows.length) return null
  const good = rows.filter((row) =>
    criticalFields.every((f) => row[f] != null && row[f] !== '')
  ).length
  return Math.round((good / rows.length) * 1000) / 10
}

/**
 * Record one ETL run.
 *
 * Never throws. A seeder that has just written 200k rows must not fail at the
 * last step because its bookkeeping row wouldn't insert — the data is the
 * point, the report is the receipt.
 *
 * @param {object} report
 * @param {string} report.dataset          'poi_index' | 'boundaries'
 * @param {string} [report.scope]          city, or omitted for a global run
 * @param {number} report.recordCount
 * @param {number} [report.completenessPct]
 * @param {boolean} [report.complete]      false when coverage is known-incomplete
 * @param {object} [report.notes]          per-dataset detail
 * @returns {Promise<boolean>} whether the row was written
 */
export async function recordQualityReport(report) {
  try {
    await prisma.dataQualityReport.create({
      data: {
        dataset: report.dataset,
        scope: report.scope ?? null,
        recordCount: report.recordCount,
        completenessPct: report.completenessPct ?? null,
        complete: report.complete ?? true,
        notes: report.notes ?? null,
      },
    })
    intelLog('spatial.quality_report', {
      dataset: report.dataset,
      scope: report.scope ?? null,
      records: report.recordCount,
      complete: report.complete ?? true,
    })
    return true
  } catch (err) {
    intelError('spatial.quality_report_failed', err, { dataset: report.dataset })
    return false
  }
}

// A known-incomplete fetch cannot claim HIGH confidence. 0.74 sits just under
// the HIGH band boundary (envelope.js's CONFIDENCE_BANDS) — see coverageFactor
// for why this is a cap and not a multiplier.
const INCOMPLETE_COVERAGE_CAP = 0.74

// `reason` is shown to users, so the dataset needs a name a person would use.
// "The last poi_index fetch" is our vocabulary, not theirs.
const DATASET_LABEL = {
  poi_index: 'places',
  boundaries: 'neighbourhood boundaries',
}

/**
 * A confidence factor reflecting whether the ETL run behind a dataset actually
 * covered what it claimed to.
 *
 * This is the wire between `DataQualityReport.complete` — which every seeder
 * has been writing all along — and the number a user reads on a card. Until it
 * existed, a city whose POI fetch half-failed produced cards indistinguishable
 * from a city whose fetch succeeded, because input availability only asks "did
 * this module get *a* POI table", never "was that table complete".
 *
 * A CAP rather than a multiplier, deliberately. `complete: false` says the run
 * knew it fell short; it does not say by how much — one timed-out tile out of
 * sixteen and fifteen timed-out tiles record identically. Picking a multiplier
 * would mean inventing that magnitude, which is precisely the authored-number
 * problem computed confidence exists to avoid. Refusing to claim HIGH is
 * something we can actually justify.
 *
 * A missing report is NOT penalised: the dev database holds 114k POIs seeded
 * before quality reporting existed, and treating absent bookkeeping as evidence
 * of bad data would degrade every card until the next re-seed. Absence of a
 * receipt is not evidence of a bad delivery.
 *
 * @param {string} dataset  'poi_index' | 'boundaries'
 * @param {string|null} [scope]  city, or null for a global run
 * @returns {Promise<{key, reason, cap}|null>} null when there is nothing to say
 */
export async function coverageFactor(dataset, scope = null) {
  try {
    const report = await prisma.dataQualityReport.findFirst({
      where: { dataset, scope: scope ?? null },
      orderBy: { runAt: 'desc' },
    })
    if (!report || report.complete !== false) return null

    const what = DATASET_LABEL[dataset] ?? dataset.replace(/_/g, ' ')
    return {
      key: 'coverage',
      // Says what we did wrong, not what the area lacks. The distinction is the
      // point of the factor: a thin count here is our incomplete copy of the
      // map, and reading it as a quiet neighbourhood would be our error
      // presented as the area's character.
      reason:
        `Our last download of ${what}${scope ? ` in ${scope}` : ''} didn't ` +
        'finish, so some nearby places are probably missing from this count.',
      cap: INCOMPLETE_COVERAGE_CAP,
    }
  } catch (err) {
    // Confidence is a read-path concern; a bookkeeping lookup must never be
    // what stops a card rendering. No factor means no reduction, which is the
    // same state as before this function existed.
    intelError('spatial.coverage_factor_failed', err, { dataset, scope })
    return null
  }
}

// How old the underlying data may get before it stops deserving full marks.
//
// Bands, not a decay curve, for the same reason CONFIDENCE_BANDS exist: a
// smooth function of age would imply we can distinguish 200-day-old data from
// 210-day-old data, and we cannot. The boundaries are what we can actually
// defend — one intended refresh cycle, and one year.
//
// §4.4 sets the intended POI refresh at quarterly, so 90 days is "on schedule"
// and carries no penalty at all.
const FRESHNESS_BANDS = [
  {
    maxAgeDays: 90,
    multiplier: 1,
    describe: () => null, // on schedule — nothing to say
  },
  {
    maxAgeDays: 365,
    multiplier: 0.9,
    describe: (months) =>
      `Our map data for this area is about ${months} months old, so a place ` +
      'that opened or closed recently may not be reflected yet.',
  },
  {
    maxAgeDays: Infinity,
    // Floored deliberately rather than decaying toward zero. Old OSM data is
    // still mostly right — hospitals, schools and parks do not move — so the
    // penalty lands on the shop-level facts that genuinely rot, and stops.
    multiplier: 0.75,
    describe: (months) =>
      `Our map data for this area is over ${Math.floor(months / 12)} year(s) ` +
      'old. Shops and restaurants in particular may have changed.',
  },
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * A confidence factor reflecting how long ago the underlying data was fetched.
 *
 * A MULTIPLIER, where coverage is a cap — and the difference is not stylistic.
 * `complete: false` tells us a run fell short without saying by how much, so
 * capping is the only honest move. Age we know exactly, so a graded reduction
 * is a claim we can actually support.
 *
 * @param {string|Date|null} fetchedAt  when the data was last pulled
 * @param {Date} [now]  injectable so tests don't depend on the wall clock
 * @returns {{key, reason, multiplier}|null} null when fresh or unknown
 */
export function freshnessFactor(fetchedAt, now = new Date()) {
  if (!fetchedAt) return null

  const then = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt)
  if (Number.isNaN(then.getTime())) return null

  const ageDays = Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY)
  // A future timestamp is a clock problem, not fresher-than-fresh data. Treat
  // it as current rather than letting it read as a negative age.
  if (ageDays <= 0) return null

  const band = FRESHNESS_BANDS.find((b) => ageDays <= b.maxAgeDays)
  const reason = band.describe(Math.round(ageDays / 30))
  if (!reason || band.multiplier >= 1) return null

  return { key: 'freshness', reason, multiplier: band.multiplier }
}

/**
 * The most recent run per (dataset, scope) pair.
 *
 * Grouped in JS rather than SQL: DISTINCT ON is Postgres-specific raw SQL, and
 * the row count here is the number of datasets times the number of cities —
 * dozens, not thousands. Simplicity wins at this size.
 *
 * @param {number} [limit] how many recent rows to consider
 */
export async function latestReports(limit = 200) {
  const rows = await prisma.dataQualityReport.findMany({
    orderBy: { runAt: 'desc' },
    take: limit,
  })

  const seen = new Set()
  const latest = []
  for (const row of rows) {
    const key = `${row.dataset}:${row.scope ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    latest.push(row)
  }
  return latest
}
