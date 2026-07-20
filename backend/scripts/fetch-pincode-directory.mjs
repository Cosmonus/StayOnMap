#!/usr/bin/env node
// Seed PincodeDirectory from India Post's directory on data.gov.in.
//
//   node scripts/fetch-pincode-directory.mjs            # dry run
//   node scripts/fetch-pincode-directory.mjs --confirm  # write (~155k rows)
//
// Why this exists: every location fact on a listing is the owner's claim, and
// nothing verified that the claimed pincode belongs to the claimed city or
// state. This directory is the ground truth those claims are checked against —
// owned locally for the same reason PoiIndex is: free per lookup, no external
// dependency in the write path, and quality-reported.
//
// Requires DATA_GOV_API_KEY (free registration — docs/operator-actions.md
// §1.6a; the same key CPCB uses). ~156 requests of 1,000 rows each.
// Pincodes change glacially; a yearly re-run is plenty. Re-runnable: rows are
// keyed on (pincode, officeName), so a re-run updates in place.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { env } from '../src/config/env.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'

const RESOURCE = '6176ee09-3d56-4a3b-8115-21841576b2f6'
const PAGE = 1000
// Verified live before this script was written: the directory reports this
// total. Used only as a sanity band, not a hard gate — offices open and close.
const EXPECTED_ROUGHLY = 155_570

const { confirm: CONFIRM } = parseSeedArgs(process.argv.slice(2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(offset) {
  const url = `https://api.data.gov.in/resource/${RESOURCE}` +
    `?api-key=${encodeURIComponent(env.dataGovApiKey)}&format=json&limit=${PAGE}&offset=${offset}`
  // The free key rate-limits (429 observed on the first full run). Backing off
  // and retrying is the difference between a 10-minute seed and a failed one —
  // and a government API telling us to slow down is an instruction, not an error.
  const waits = [5_000, 15_000, 30_000, 60_000, 120_000]
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (res.ok) return res.json()
    if (res.status !== 429 || attempt >= waits.length) {
      throw new Error(`data.gov.in → HTTP ${res.status} at offset ${offset}`)
    }
    process.stdout.write(`  429 at ${offset} — waiting ${waits[attempt] / 1000}s
`)
    await sleep(waits[attempt])
  }
}

/** One API record → one row, or null when it lacks what a lookup needs. */
function toRow(r) {
  const pincode = String(r.pincode ?? '').trim()
  const officeName = String(r.officename ?? '').trim()
  const district = String(r.districtname ?? '').trim()
  const state = String(r.statename ?? '').trim()
  // A row without these answers no question we ask of this table.
  if (!/^\d{6}$/.test(pincode) || !officeName || !district || !state) return null
  return {
    pincode,
    officeName,
    officeType: r.officetype || null,
    delivery: String(r.deliverystatus ?? '').toLowerCase() !== 'non delivery',
    taluk: r.taluk || null,
    division: r.divisionname || null,
    region: r.regionname || null,
    circle: r.circlename || null,
    district,
    state,
  }
}

async function main() {
  if (!env.dataGovApiKey) {
    console.error('DATA_GOV_API_KEY is not set — see docs/operator-actions.md §1.6a')
    process.exitCode = 1
    return
  }

  const first = await fetchPage(0)
  const total = Number(first.total) || 0
  console.log(`directory reports ${total} offices (expected roughly ${EXPECTED_ROUGHLY})`)
  if (total < EXPECTED_ROUGHLY * 0.8) {
    console.error('total is far below expectation — refusing to treat a truncated feed as the directory')
    process.exitCode = 1
    return
  }

  const fetchedAt = new Date()
  let written = 0
  let skipped = 0
  let failedPages = 0

  // A dry run proves connectivity and row mapping; paging all 156 pages
  // without writing spends the day's rate limit on nothing — which is exactly
  // how the first confirmed run met a 429 at offset 0.
  const pageLimit = CONFIRM ? total : PAGE * 3
  for (let offset = 0; offset < pageLimit; offset += PAGE) {
    let body
    try {
      body = offset === 0 ? first : await fetchPage(offset)
    } catch (err) {
      // A missing page is a coverage gap, not a reason to lose the rest.
      failedPages++
      console.warn(`  page at ${offset} FAILED — ${err.message}`)
      continue
    }

    const rows = (body.records ?? []).map(toRow).filter(Boolean)
    skipped += (body.records ?? []).length - rows.length

    if (CONFIRM && rows.length) {
      // Same non-transactional batched-upsert reasoning as fetch-osm-pois.mjs:
      // every row is independent and keyed, so a half-finished run converges on
      // re-run, and a transaction over a remote proxy just hits the 5s cap.
      for (let i = 0; i < rows.length; i += 25) {
        await Promise.all(rows.slice(i, i + 25).map((row) =>
          prisma.pincodeDirectory.upsert({
            where: { pincode_officeName: { pincode: row.pincode, officeName: row.officeName } },
            create: { ...row, fetchedAt },
            update: { ...row, fetchedAt },
          })
        ))
      }
    }
    written += rows.length
    process.stdout.write(`  ${Math.min(offset + PAGE, total)}/${total} (${written} usable)\n`)
    await sleep(1000) // free service with a per-minute cap; stay under it
  }

  console.log(`\n${CONFIRM ? 'written' : 'would write'}: ${written}  skipped (unusable): ${skipped}  failed pages: ${failedPages}`)

  if (CONFIRM) {
    await recordQualityReport({
      dataset: 'pincode_directory',
      recordCount: written,
      completenessPct: completeness([{ ok: written }], ['ok']) ?? null,
      complete: failedPages === 0,
      notes: { source: 'data.gov.in ' + RESOURCE, skipped, failedPages },
    })
    const distinct = await prisma.pincodeDirectory.groupBy({ by: ['state'], _count: true })
    console.log(`states covered: ${distinct.length}`)
  } else {
    console.log('Nothing was written. Re-run with --confirm.')
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
