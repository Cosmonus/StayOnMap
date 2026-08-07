#!/usr/bin/env node
// Resolve every existing listing to a Locality.
//
// New listings resolve themselves on write (properties.service.js). This is for
// the ones that already existed when the entity shipped.
//
// DRY RUN BY DEFAULT, like every other seeder in this directory. Pass --confirm
// to write. Re-runnable: resolution is idempotent, so running it twice resolves
// nothing new the second time.
//
//   node --env-file=.env scripts/backfill-localities.mjs
//   node --env-file=.env scripts/backfill-localities.mjs --confirm
//
// On the production VM the env is not a local .env file — see .claude/ops.md:
//   DATABASE_URL=... node scripts/backfill-localities.mjs --confirm
//
// NOTE ON COVERAGE. A listing resolves to a BOUNDARY locality only where OSM
// admin polygons have been seeded for its city (scripts/fetch-osm-boundaries.mjs).
// Without them everything falls back to LANDMARK, which is a working outcome —
// the entity still merges spellings — but it is not the good one. Ahmedabad and
// Surat have no ward/zone polygons in OSM at all, so LANDMARK is permanent
// there. The summary below breaks the result down by source so the difference
// between "not seeded yet" and "genuinely unavailable" stays visible.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { resolveLocality } from '../src/features/localities/resolve.js'

const confirm = process.argv.includes('--confirm')

async function main() {
  const properties = await prisma.property.findMany({
    where: { localityId: null },
    select: { id: true, city: true, lat: true, lng: true, landmark: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`${properties.length} listing(s) with no locality.`)
  if (!properties.length) return

  const stats = { BOUNDARY: 0, LANDMARK: 0, unresolved: 0 }
  const byCity = new Map()

  for (const property of properties) {
    const localityId = await resolveLocality(property)

    if (!localityId) {
      stats.unresolved++
      bump(byCity, property.city, 'unresolved')
      console.log(`  ✗ ${property.id}  ${property.city}  (no boundary, no usable landmark)`)
      continue
    }

    const locality = await prisma.locality.findUnique({
      where: { id: localityId },
      select: { name: true, source: true, adminLevel: true },
    })
    stats[locality.source]++
    bump(byCity, property.city, locality.source)

    const label = locality.source === 'BOUNDARY'
      ? `${locality.name} (admin level ${locality.adminLevel})`
      : `${locality.name} (from landmark)`
    console.log(`  ✓ ${property.id}  ${property.city}  →  ${label}`)

    if (confirm) {
      await prisma.property.update({ where: { id: property.id }, data: { localityId } })
    }
  }

  console.log('\nBy source:')
  console.log(`  BOUNDARY   ${stats.BOUNDARY}  (resolved from the map)`)
  console.log(`  LANDMARK   ${stats.LANDMARK}  (fell back to owner-typed text)`)
  console.log(`  unresolved ${stats.unresolved}`)

  console.log('\nBy city:')
  for (const [city, counts] of [...byCity.entries()].sort()) {
    const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')
    console.log(`  ${city.padEnd(12)} ${parts}`)
  }

  // Localities are created by resolveLocality() whether or not --confirm is set,
  // because creating them is what tells you what the result WOULD be. Say so
  // rather than letting a "dry run" quietly leave rows behind.
  if (!confirm) {
    console.log('\nDRY RUN — no listing was linked. Locality rows above were created')
    console.log('so the preview could name them; re-run with --confirm to link the listings.')
  }
}

function bump(map, city, key) {
  const counts = map.get(city) ?? {}
  counts[key] = (counts[key] ?? 0) + 1
  map.set(city, counts)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
