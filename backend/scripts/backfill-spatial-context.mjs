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
// Cheap by construction: listings cluster, so many share a geohash-7 cell and
// each distinct cell is computed exactly once. The dry run prints how many
// distinct cells your listings actually occupy, which is the number that
// drives the API cost — run it first.
import 'dotenv/config'
// The singleton, not a fresh PrismaClient — Prisma 7 needs an explicit driver
// adapter and lib/prisma.js is where that's configured (see .claude/database.md).
import { prisma } from '../src/lib/prisma.js'
import { encode } from '../src/lib/geohash.js'
import { materialize } from '../src/features/spatial/spatial.service.js'
import { resolveCity } from '../src/config/cityCenters.js'

const CONFIRM = process.argv.includes('--confirm')

// Sequential with a small pause: this is bulk background work and there is no
// reason to fan a burst of billed calls at Google all at once.
const DELAY_MS = 500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lng: true, city: true, type: true },
  })

  const cells = new Map() // geohash → { city, listings }
  let skipped = 0

  for (const p of properties) {
    if (p.lat == null || p.lng == null) { skipped++; continue }
    const geohash = encode(Number(p.lat), Number(p.lng))
    const entry = cells.get(geohash) ?? {
      city: p.city ?? resolveCity(Number(p.lat), Number(p.lng))?.city ?? null,
      listings: 0,
      // Types present in this cell. A cell is warmed once PER TYPE, because
      // mobility's destination differs by type and is stored in a per-type
      // slot — a shop and the flats above it need different answers from the
      // same coordinate. Type-specific modules are all free PoiIndex queries,
      // so the extra passes cost nothing beyond one Distance Matrix call each.
      types: new Set(),
    }
    entry.listings++
    entry.types.add(p.type)
    cells.set(geohash, entry)
  }

  const existing = await prisma.spatialContext.findMany({
    where: { geohash: { in: [...cells.keys()] } },
    select: { geohash: true },
  })
  const known = new Set(existing.map((r) => r.geohash))
  const todo = [...cells.keys()].filter((g) => !known.has(g))
  const passes = todo.reduce((n, g) => n + cells.get(g).types.size, 0)

  console.log(`${properties.length} listings${skipped ? ` (${skipped} without coordinates, skipped)` : ''}`)
  console.log(`${cells.size} distinct cells — ${known.size} already warm, ${todo.length} to compute (${passes} type passes)`)

  const byCity = {}
  for (const [g, e] of cells) if (!known.has(g)) byCity[e.city ?? 'unknown'] = (byCity[e.city ?? 'unknown'] ?? 0) + 1
  for (const [city, n] of Object.entries(byCity)) console.log(`    ${String(city).padEnd(12)} ${n} cell(s)`)

  if (!todo.length) { console.log('\nNothing to do.'); return }
  if (!CONFIRM) { console.log('\nDRY RUN — nothing computed. Re-run with --confirm.'); return }

  console.log('')
  let done = 0
  for (const geohash of todo) {
    await materialize(geohash)
    done++
    process.stdout.write(`  ${done}/${todo.length} cells\r`)
    if (done < todo.length) await sleep(DELAY_MS)
  }
  console.log(`\nWarmed ${done} cells.`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
