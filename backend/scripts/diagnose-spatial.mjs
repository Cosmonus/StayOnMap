#!/usr/bin/env node
/**
 * Read-only production diagnostic for the spatial intelligence layer.
 *
 *   node scripts/diagnose-spatial.mjs
 *
 * Answers one question: WHY are Spatial Intelligence cards empty?
 *
 * The layer has several independent ways to produce an empty card — no
 * SpatialContext row, an empty PoiIndex, a stale cell, a circuit-broken cell,
 * or a module that computed but returned no facts. They look identical in the
 * UI and are trivially distinguishable in the database, so guessing is never
 * necessary. This script never writes.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { encode, DEFAULT_PRECISION } from '../src/lib/geohash.js'

// Must match what spatial.service.js keys cells by — encode() defaults to it.
const CELL_PRECISION = DEFAULT_PRECISION

const pct = (n, d) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`)
const head = (t) => console.log(`\n${'─'.repeat(66)}\n${t}\n${'─'.repeat(66)}`)

/** Properties are what the user actually looks at — coverage is measured against them, not against cells. */
async function propertyCoverage() {
  head('1. PROPERTY COVERAGE  (the number that matches the symptom)')

  // No coordinate filter: Property.lat/lng are NON-NULLABLE (schema.prisma:460),
  // so "a listing without coordinates" is not a state this database can hold.
  // Worth stating, because it rules out one otherwise-plausible cause of an
  // empty card without anyone having to go looking for it.
  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lng: true, city: true, type: true, status: true },
  })

  if (properties.length === 0) {
    console.log('No properties in this database.')
    return
  }

  const cells = new Map() // geohash -> properties in it
  for (const p of properties) {
    const gh = encode(Number(p.lat), Number(p.lng), CELL_PRECISION)
    if (!cells.has(gh)) cells.set(gh, [])
    cells.get(gh).push(p)
  }

  const known = await prisma.spatialContext.findMany({
    where: { geohash: { in: [...cells.keys()] } },
    select: { geohash: true, modules: true, staleAfter: true, failCount: true },
  })
  const byHash = new Map(known.map((c) => [c.geohash, c]))

  const now = new Date()
  const buckets = { ok: 0, stale: 0, failing: 0, noFacts: 0, absent: 0 }
  const perCity = new Map()

  for (const [gh, props] of cells) {
    const ctx = byHash.get(gh)
    let bucket
    if (!ctx) bucket = 'absent'
    else if (ctx.failCount > 0) bucket = 'failing'
    else if (!hasAnyFact(ctx.modules)) bucket = 'noFacts'
    else if (ctx.staleAfter < now) bucket = 'stale'
    else bucket = 'ok'

    buckets[bucket] += props.length
    for (const p of props) {
      const city = p.city ?? '(none)'
      if (!perCity.has(city)) perCity.set(city, { total: 0, covered: 0 })
      const row = perCity.get(city)
      row.total++
      if (bucket === 'ok' || bucket === 'stale') row.covered++
    }
  }

  const total = properties.length
  console.log(`Properties                : ${total}`)
  console.log(`Distinct geohash-${CELL_PRECISION} cells  : ${cells.size}`)
  console.log('')
  console.log(`  renders normally          : ${buckets.ok} (${pct(buckets.ok, total)})`)
  console.log(`  stale but still renders   : ${buckets.stale} (${pct(buckets.stale, total)})`)
  console.log(`  EMPTY - no context row    : ${buckets.absent} (${pct(buckets.absent, total)})`)
  console.log(`  EMPTY - circuit-broken    : ${buckets.failing} (${pct(buckets.failing, total)})`)
  console.log(`  EMPTY - computed, 0 facts : ${buckets.noFacts} (${pct(buckets.noFacts, total)})`)

  console.log('\nBy city:')
  for (const [city, r] of [...perCity].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${city.padEnd(14)} ${String(r.covered).padStart(5)}/${String(r.total).padEnd(5)} covered  ${pct(r.covered, r.total)}`)
  }
}

function hasAnyFact(modules) {
  if (!modules || typeof modules !== 'object') return false
  return Object.values(modules).some(
    (e) => Array.isArray(e?.facts) && e.facts.length > 0,
  )
}

/** A module can materialise successfully and still be useless. Per-module fact counts show which. */
async function moduleHealth() {
  head('2. MODULE HEALTH  (which modules produce facts, which produce nothing)')

  const rows = await prisma.spatialContext.findMany({
    select: { modules: true },
    take: 2000,
  })
  if (rows.length === 0) {
    console.log('No SpatialContext rows at all — nothing to measure.')
    return
  }

  const stats = new Map()
  for (const row of rows) {
    const modules = row.modules ?? {}
    for (const [key, env] of Object.entries(modules)) {
      if (!stats.has(key)) stats.set(key, { present: 0, withFacts: 0, facts: 0, bands: new Map() })
      const s = stats.get(key)
      s.present++
      const n = Array.isArray(env?.facts) ? env.facts.length : 0
      if (n > 0) s.withFacts++
      s.facts += n
      const band = env?.confidence?.band ?? '(none)'
      s.bands.set(band, (s.bands.get(band) ?? 0) + 1)
    }
  }

  console.log(`Sampled ${rows.length} cells.\n`)
  console.log('module            present  with facts   avg facts  confidence bands')
  for (const [key, s] of [...stats].sort()) {
    const bands = [...s.bands].sort((a, b) => b[1] - a[1]).map(([b, c]) => `${b}:${c}`).join(' ')
    console.log(
      `  ${key.padEnd(16)}${String(s.present).padStart(6)}${String(s.withFacts).padStart(11)}` +
      `${(s.facts / s.present).toFixed(1).padStart(11)}  ${bands}`,
    )
  }
  console.log('\nA module with present > 0 but withFacts == 0 is computing and returning nothing.')
}

/** Every downstream module reads PoiIndex. If it is empty, everything is empty. */
async function poiHealth() {
  head('3. POI INDEX  (the dependency almost everything else reads)')

  const total = await prisma.poiIndex.count()
  console.log(`Total POIs: ${total}`)
  if (total === 0) {
    console.log('\n*** PoiIndex is EMPTY. scripts/fetch-osm-pois.mjs has never run here. ***')
    console.log('    Every POI-derived module will report "nothing nearby" for every cell.')
    return
  }

  const byCity = await prisma.poiIndex.groupBy({
    by: ['city'],
    _count: { _all: true },
    _max: { fetchedAt: true },
  })
  console.log('\ncity            POIs     last fetched')
  for (const r of byCity.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${(r.city ?? '?').padEnd(14)}${String(r._count._all).padStart(7)}     ${r._max.fetchedAt?.toISOString().slice(0, 10)}`)
  }

  const byCategory = await prisma.poiIndex.groupBy({
    by: ['category'],
    _count: { _all: true },
  })
  console.log('\nCategories present:', byCategory.length)
  const empty = byCategory.filter((c) => c._count._all < 10)
  if (empty.length) {
    console.log('Suspiciously thin categories (<10 rows nationally):')
    for (const c of empty) console.log(`  ${c.category}: ${c._count._all}`)
  }
}

/** The other datasets the newer modules depend on. */
async function auxDatasets() {
  head('4. SUPPORTING DATASETS')
  const boundaries = await prisma.boundary.count().catch(() => null)
  console.log(`Boundary rows      : ${boundaries ?? 'TABLE MISSING (migration not applied)'}`)
  if (boundaries === 0) console.log('  -> locality module has nothing to resolve against.')
}

/** The ETL's own self-report — distinguishes "sparse area" from "failed fetch". */
async function etlReports() {
  head('5. LAST ETL RUN PER DATASET')
  const reports = await prisma.dataQualityReport.findMany({
    orderBy: { runAt: 'desc' },
    take: 40,
  }).catch(() => null)

  if (reports === null) return console.log('DataQualityReport table missing (migration not applied).')
  if (reports.length === 0) return console.log('No ETL run has EVER been recorded in this database.')

  const seen = new Set()
  for (const r of reports) {
    const key = `${r.dataset}::${r.scope ?? '-'}`
    if (seen.has(key)) continue
    seen.add(key)
    const age = Math.floor((Date.now() - r.runAt.getTime()) / 86400000)
    const flag = r.complete ? 'complete' : '*** INCOMPLETE ***'
    console.log(`  ${key.padEnd(28)} ${String(r.recordCount).padStart(7)} rows  ${age}d ago  ${flag}`)
  }
}

async function verdict() {
  head('VERDICT')
  const [contexts, pois] = await Promise.all([
    prisma.spatialContext.count(),
    prisma.poiIndex.count(),
  ])
  if (contexts === 0 && pois === 0) {
    console.log('Nothing has ever been ingested or materialised in this database.')
    console.log('Run, in order: fetch-osm-pois.mjs -> fetch-osm-boundaries.mjs -> backfill-spatial-context.mjs')
  } else if (pois === 0) {
    console.log('POI ingestion never ran. Cells may exist but cannot contain POI-derived facts.')
  } else if (contexts === 0) {
    console.log('POIs exist but no cell has been materialised. Run backfill-spatial-context.mjs.')
  } else {
    console.log('Both datasets are populated — read sections 1 and 2 above to find which')
    console.log('cells or modules are failing. Empty cards are then localised, not systemic.')
  }
}

async function main() {
  console.log('StayOnMap — spatial intelligence diagnostic (read-only)')
  console.log(`Database: ${(process.env.DATABASE_URL ?? '').replace(/:[^:@]+@/, ':***@') || '(unset)'}`)
  await propertyCoverage()
  await moduleHealth()
  await poiHealth()
  await auxDatasets()
  await etlReports()
  await verdict()
  console.log('')
}

main()
  .catch((err) => {
    console.error('\nDiagnostic failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
