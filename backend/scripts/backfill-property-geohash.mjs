#!/usr/bin/env node
// Fill in Property.geohash for listings that predate the column.
//
//   node scripts/backfill-property-geohash.mjs           # dry run
//   node scripts/backfill-property-geohash.mjs --confirm
//
// `geohash` is a listing's only link to the spatial layer's per-cell data, and
// proximity filters exclude rows where it is null — an un-backfilled row is of
// UNKNOWN proximity, not "no". So until this runs, every pre-existing listing is
// invisible to "within 800 m of a metro", which looks exactly like the filter
// being broken.
//
// Pure arithmetic: no API calls, no cost, no upstream to be down. Safe to re-run
// (it only writes rows whose geohash is null or has drifted from their coords).
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { encode } from '../src/lib/geohash.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'

const { confirm: CONFIRM } = parseSeedArgs(process.argv.slice(2))

// Written in batches so a large table does not become one enormous transaction.
const BATCH = 500

async function main() {
  const properties = await prisma.property.findMany({
    select: { id: true, lat: true, lng: true, geohash: true },
  })

  const updates = []
  let skipped = 0

  for (const p of properties) {
    if (p.lat == null || p.lng == null) { skipped++; continue }
    const geohash = encode(Number(p.lat), Number(p.lng))
    // Recompute rather than only filling nulls: a listing whose coordinates were
    // corrected would otherwise keep pointing at the cell it used to be in.
    if (p.geohash === geohash) continue
    updates.push({ id: p.id, geohash })
  }

  console.log(`${properties.length} listings, ${updates.length} need a geohash, ${skipped} have no coordinates`)

  if (!updates.length) {
    console.log('Nothing to do.')
    return
  }

  if (!CONFIRM) {
    for (const u of updates.slice(0, 10)) console.log(`  ${u.id} → ${u.geohash}`)
    if (updates.length > 10) console.log(`  … and ${updates.length - 10} more`)
    console.log('\nDry run. Re-run with --confirm to write.')
    return
  }

  let written = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    // updateMany, not update: `update` throws P2025 when a row has been deleted
    // between the read above and this write, which on a live database rolls back
    // the whole 500-row transaction and aborts the run — leaving earlier batches
    // committed and the operator holding a stack trace with no idea how far it
    // got. updateMany is a no-op on a missing row, which is what makes this
    // script genuinely re-runnable, as its header claims.
    await prisma.$transaction(
      batch.map((u) => prisma.property.updateMany({ where: { id: u.id }, data: { geohash: u.geohash } }))
    )
    written += batch.length
    console.log(`  ${written}/${updates.length}`)
  }

  console.log(`✓ ${written} listings updated`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  // Explicit disconnect: without it the Prisma connection keeps the event loop
  // alive and the script hangs after finishing (see roadmap — the same thing
  // caught the OSM seeders).
  .finally(() => prisma.$disconnect())
