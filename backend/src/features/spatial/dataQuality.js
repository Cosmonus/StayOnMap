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
 * @param {string} report.dataset          'poi_index' | 'boundaries' | 'weather_normals'
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
