#!/usr/bin/env node
// Warm the spatial cell for every existing listing.
//
// Cells are materialised at listing create/publish, so only listings that
// predate the spatial layer are cold — which, right after shipping it, is all
// of them. Without this the first person to open each listing triggers the
// computation themselves and may see the "working it out" state.
//
//   node scripts/backfill-spatial-context.mjs           # dry run
//   node scripts/backfill-spatial-context.mjs --confirm
//
// Run AFTER scripts/fetch-osm-pois.mjs, not before: with an empty PoiIndex
// each cell falls back to metered Google calls (or persists "not loaded"
// envelopes), and those get stored. The guard below refuses to run against an
// unseeded table unless you pass --allow-unseeded on purpose.
//
// Cheap by construction: listings cluster, so many share a geohash-7 cell and
// each distinct cell is computed once PER PROPERTY TYPE present in it —
// mobility's destination differs by type and is stored in a per-type slot, so
// a shop and the flats above it need separate passes. Type-specific modules
// are free PoiIndex queries; the only metered thing is one Distance Matrix
// call per pass. The dry run prints the pass count — run it first.
import 'dotenv/config'
// The singleton, not a fresh PrismaClient — Prisma 7 needs an explicit driver
// adapter and lib/prisma.js is where that's configured (see .claude/database.md).
import { prisma } from '../src/lib/prisma.js'
import { encode } from '../src/lib/geohash.js'
import { materialize, storageKey } from '../src/features/spatial/spatial.service.js'
import { modulesFor, isStale } from '../src/features/spatial/registry.js'
import { resolveCity } from '../src/config/cityCenters.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'

const { confirm: CONFIRM, allowUnseeded: ALLOW_UNSEEDED } = parseSeedArgs(process.argv.slice(2))

// Sequential with a small pause: this is bulk background work and there is no
// reason to fan a burst of billed calls at Google all at once.
const DELAY_MS = 500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Every wanted module fresh in this row for this type? */
function warmFor(row, type) {
  if (!row?.modules) return false
  return modulesFor(type).every((m) => !isStale(row.modules[storageKey(m, type)], m))
}

async function main() {
  const poiRows = await prisma.poiIndex.count()
  if (poiRows === 0 && !ALLOW_UNSEEDED) {
    console.error(
      'PoiIndex is empty — run scripts/fetch-osm-pois.mjs --confirm first.\n' +
      'Backfilling now would persist Google-fallback / "not loaded" envelopes\n' +
      'for up to their full TTLs. Pass --allow-unseeded to do it anyway.'
    )
    process.exitCode = 1
    return
  }

  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lng: true, city: true, type: true },
  })

  const cells = new Map() // geohash → { city, listings, types }
  let skipped = 0

  for (const p of properties) {
    if (p.lat == null || p.lng == null) { skipped++; continue }
    const geohash = encode(Number(p.lat), Number(p.lng))
    const entry = cells.get(geohash) ?? {
      city: p.city ?? resolveCity(Number(p.lat), Number(p.lng))?.city ?? null,
      listings: 0,
      types: new Set(),
    }
    entry.listings++
    entry.types.add(p.type)
    cells.set(geohash, entry)
  }

  const existing = await prisma.spatialContext.findMany({
    where: { geohash: { in: [...cells.keys()] } },
    select: { geohash: true, modules: true },
  })
  const rowByGeohash = new Map(existing.map((r) => [r.geohash, r]))

  // One pass per (cell, type) that is missing or stale for that type. A cell
  // warmed by an apartment is NOT warm for the shop on its ground floor — the
  // old version skipped any cell with a row at all, leaving per-type slots
  // (and everything a later module version wants) permanently cold.
  const passes = []
  for (const [geohash, entry] of cells) {
    const row = rowByGeohash.get(geohash) ?? null
    for (const type of entry.types) {
      if (!warmFor(row, type)) passes.push({ geohash, type, city: entry.city })
    }
  }

  const coldCells = new Set(passes.map((p) => p.geohash))
  console.log(`${properties.length} listings${skipped ? ` (${skipped} without coordinates, skipped)` : ''}`)
  console.log(`${cells.size} distinct cells — ${cells.size - coldCells.size} fully warm, ${coldCells.size} need work (${passes.length} type passes)`)

  const byCity = {}
  for (const p of passes) byCity[p.city ?? 'unknown'] = (byCity[p.city ?? 'unknown'] ?? 0) + 1
  for (const [city, n] of Object.entries(byCity)) console.log(`    ${String(city).padEnd(12)} ${n} pass(es)`)

  if (!passes.length) { console.log('\nNothing to do.'); return }
  if (!CONFIRM) { console.log('\nDRY RUN — nothing computed. Re-run with --confirm.'); return }

  console.log('')
  let done = 0
  // Isolate per pass. This used to let a single materialize() throw abort the
  // whole run — the odd one out among the three seeders, both of which isolate
  // per tile/level. One cell with bad coordinates or an upstream blip should
  // not end a 40-minute backfill; the run is resumable either way, but a
  // partial run that reports WHICH passes failed is worth far more than a stack
  // trace and an unknown amount of completed work.
  const failures = []
  for (const { geohash, type } of passes) {
    try {
      await materialize(geohash, type)
    } catch (err) {
      failures.push({ geohash, type, message: err.message })
    }
    done++
    process.stdout.write(`  ${done}/${passes.length} passes\r`)
    if (done < passes.length) await sleep(DELAY_MS)
  }

  const ok = done - failures.length
  console.log(`\nCompleted ${ok} of ${done} passes across ${coldCells.size} cells.`)

  if (failures.length) {
    console.log(`\n${failures.length} pass(es) failed:`)
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.geohash} (${f.type ?? 'ANY'}): ${f.message}`)
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`)
    console.log('\nRe-run to retry only what is still cold. A cell that fails 5')
    console.log('times in a row is circuit-broken and will stop being retried.')
    process.exitCode = 1
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
