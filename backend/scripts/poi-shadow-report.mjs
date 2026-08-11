#!/usr/bin/env node
// Shadow validation for the POI intelligence layer.
//
// Answers one question before anything is switched on: does the new dedupe rule
// change what a user would see, and where? Plus a trust-score distribution so
// an operator can look at real numbers rather than a promise about them.
//
// READ-ONLY. It writes nothing to PoiIndex, changes no production behaviour, and
// the scoring pass runs with dryRun so not even scoredAt moves. The one write is
// an optional DataQualityReport row (--record), which is a receipt, not data.
//
//   node --env-file=.env scripts/poi-shadow-report.mjs
//   node --env-file=.env scripts/poi-shadow-report.mjs --city Bengaluru
//   node --env-file=.env scripts/poi-shadow-report.mjs --city Bengaluru --record
//
// Samples the cells that actually MATTER — the geohashes real listings sit in —
// rather than a random slice of the country. A rule change that only affects
// places nobody is looking at is not a finding, and a random sample over a
// national POI table is mostly places nobody is looking at.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { haversineMeters } from '../src/lib/geohash.js'
import { decode } from '../src/lib/geohash.js'
import { compareDedupe, summariseDedupe, summariseScores } from '../src/features/spatial/poiShadow.js'
import { scorePoiBatch } from '../src/features/spatial/poiScoring.service.js'
import { recordQualityReport } from '../src/features/spatial/dataQuality.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { CATEGORY_KEYS } from '../src/features/spatial/poiCategories.js'

const { city: ONLY_CITY } = parseSeedArgs(process.argv.slice(2))
const RECORD = process.argv.includes('--record')

// The radius the comparison runs at. 1.6 km is `lifestyle`'s own reach and the
// outer edge of where people walk — the distance at which a dedupe difference
// actually reaches a card.
const RADIUS_M = 1600
// How many listing cells to sample. Enough for a per-category signal, small
// enough that this finishes in a minute against a remote database.
const MAX_CELLS = 60
const DEG_LAT_M = 111_320

async function cellsToSample() {
  const rows = await prisma.property.findMany({
    where: { geohash: { not: null }, ...(ONLY_CITY ? { city: ONLY_CITY } : {}) },
    select: { geohash: true, city: true },
    distinct: ['geohash'],
    take: MAX_CELLS,
  })
  if (rows.length) return rows

  // No listings with a geohash yet — a fresh or un-backfilled database. Fall
  // back to POI cells so the report still says something, and SAY that it did:
  // a sample the reader thinks is listing-weighted when it is not would make
  // this report quietly less meaningful than it looks.
  console.log('  (no listings with a geohash — sampling POI locations instead)')
  const pois = await prisma.poiIndex.findMany({
    where: { status: 'ACTIVE', ...(ONLY_CITY ? { city: ONLY_CITY } : {}) },
    select: { lat: true, lng: true, city: true },
    take: MAX_CELLS,
  })
  return pois.map((p) => ({ geohash: null, city: p.city, lat: Number(p.lat), lng: Number(p.lng) }))
}

/** Every ACTIVE POI within RADIUS_M, grouped by category, distance-sorted. */
async function hitsAround(lat, lng) {
  const dLat = RADIUS_M / DEG_LAT_M
  const dLng = RADIUS_M / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180))

  const rows = await prisma.poiIndex.findMany({
    where: {
      status: 'ACTIVE',
      category: { in: CATEGORY_KEYS },
      lat: { gte: lat - dLat, lte: lat + dLat },
      lng: { gte: lng - dLng, lte: lng + dLng },
    },
    select: { osmId: true, category: true, name: true, brand: true, lat: true, lng: true },
  })

  const byCategory = {}
  for (const row of rows) {
    const pLat = Number(row.lat)
    const pLng = Number(row.lng)
    const distanceM = Math.round(haversineMeters(lat, lng, pLat, pLng))
    if (distanceM > RADIUS_M) continue
    ;(byCategory[row.category] ??= []).push({ ...row, lat: pLat, lng: pLng, distanceM })
  }
  for (const list of Object.values(byCategory)) list.sort((a, b) => a.distanceM - b.distanceM)
  return byCategory
}

function printDedupe(summary) {
  console.log('\n── Dedupe: old flat 30/150 m vs per-category footprints ──')
  console.log(`  ${summary.samples} category-samples across the sampled cells`)
  console.log(`  ${summary.appeared} place(s) the new rule KEEPS that the old one merged away`)
  console.log(`  ${summary.disappeared} place(s) the new rule MERGES that the old one kept`)
  console.log(`  ${summary.nearestChanged} sample(s) where the NEAREST result changed`)
  console.log(`  ${summary.categoriesChanged} categor(ies) affected at all\n`)

  const rows = Object.entries(summary.byCategory)
    .filter(([, v]) => v.appeared || v.disappeared)
    .sort((a, b) => (b[1].appeared + b[1].disappeared) - (a[1].appeared + a[1].disappeared))

  if (!rows.length) {
    console.log('  No category changed. Either the sample is too small or the')
    console.log('  new thresholds agree with the old ones where listings are.')
    return
  }
  console.log('  category        new radii    kept+   merged+   nearest moved')
  for (const [cat, v] of rows) {
    console.log(
      `  ${cat.padEnd(15)} ${String(v.thresholds.next.join('/')).padEnd(11)} ` +
      `${String(v.appeared).padEnd(8)} ${String(v.disappeared).padEnd(9)} ${v.nearestChanged}`
    )
  }
}

async function main() {
  console.log(ONLY_CITY ? `Shadow report — ${ONLY_CITY}` : 'Shadow report — all cities')
  console.log('READ-ONLY: no POI row is modified by this script.\n')

  const cells = await cellsToSample()
  if (!cells.length) {
    console.log('Nothing to sample — PoiIndex is empty for this scope.')
    return
  }
  console.log(`Sampling ${cells.length} cell(s) at ${RADIUS_M} m…`)

  const comparisons = []
  for (const cell of cells) {
    const { lat, lng } = cell.geohash ? decode(cell.geohash) : cell
    const byCategory = await hitsAround(lat, lng)
    for (const [category, hits] of Object.entries(byCategory)) {
      // One hit can never dedupe differently, and including these would dilute
      // every rate in the report with samples that could not have changed.
      if (hits.length < 2) continue
      comparisons.push(compareDedupe(hits, category))
    }
  }

  const dedupe = summariseDedupe(comparisons)
  printDedupe(dedupe)

  // ── Scoring, dry-run. Nothing is written, including scoredAt.
  console.log('\n── TrustScore distribution (dry run — nothing written) ──')
  const dry = await scorePoiBatch({ city: ONLY_CITY, now: new Date(), dryRun: true })
  const sample = await prisma.poiIndex.findMany({
    where: { status: 'ACTIVE', ...(ONLY_CITY ? { city: ONLY_CITY } : {}) },
    select: { trustScore: true },
    take: 5000,
  })
  const scores = summariseScores(sample)
  console.log(`  ${scores.total} sampled — ${scores.unscored} never scored`)
  for (const [band, n] of Object.entries(scores.bands)) console.log(`    ${band.padEnd(9)} ${n}`)
  console.log(`  dry-run pass would have scored ${dry.scored}, verified ${dry.verified}, contradicted ${dry.contradicted}`)

  if (RECORD) {
    await recordQualityReport({
      dataset: 'poi_shadow',
      scope: ONLY_CITY ?? null,
      recordCount: dedupe.samples,
      complete: true,
      notes: { dedupe, scores, dryRun: dry, radiusM: RADIUS_M, cells: cells.length },
    })
    console.log('\nRecorded as a DataQualityReport row (dataset: poi_shadow).')
  }

  // Deliberately does NOT print a recommendation. The numbers above are the
  // deliverable; "safe to enable" is a judgement about a product, and a script
  // that makes it invites someone to skip reading the rows it made it from.
  console.log('\nDone. Nothing was changed.')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0) })
