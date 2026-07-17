#!/usr/bin/env node
/**
 * One-off data migration: 'Gated Security' → 'Gated Community'.
 *
 * Two names for one concept. 'Gated Security' was filterable but no wizard
 * chip ever offered it, so owners tagged 'Gated Community' while searchers
 * filtered 'Gated Security' and matched nothing. 'Gated Community' won (it's
 * the term renters use, and the only one owners could actually apply), and
 * 'Gated Security' left prisma/amenities.js on 2026-07-17.
 *
 * Dropping it from that list does NOT touch the database: the Amenity row and
 * any PropertyAmenity links survive, so listings tagged with it would keep the
 * tag while being unsearchable. This moves those links over and removes the row.
 *
 * Dry-run by default. Pass --confirm to write.
 *
 *   node scripts/remap-gated-security.mjs            # report only
 *   node scripts/remap-gated-security.mjs --confirm  # apply
 *
 * Safe to re-run: it no-ops once the old amenity is gone.
 */
import { prisma } from '../src/lib/prisma.js'

const OLD = 'Gated Security'
const NEW = 'Gated Community'
const confirm = process.argv.includes('--confirm')

const old = await prisma.amenity.findUnique({ where: { name: OLD } })
if (!old) {
  console.log(`✓ Nothing to do — "${OLD}" does not exist in this database.`)
  await prisma.$disconnect()
  process.exit(0)
}

const target = await prisma.amenity.upsert({
  where: { name: NEW }, update: {}, create: { name: NEW },
})

const links = await prisma.propertyAmenity.findMany({
  where: { amenityId: old.id }, select: { propertyId: true },
})

// A property may already carry both names; those links merge rather than
// duplicate (propertyId+amenityId is the composite key).
const existing = new Set(
  (await prisma.propertyAmenity.findMany({
    where: { amenityId: target.id, propertyId: { in: links.map((l) => l.propertyId) } },
    select: { propertyId: true },
  })).map((l) => l.propertyId)
)
const toMove = links.filter((l) => !existing.has(l.propertyId))

console.log(`"${OLD}" is on ${links.length} listing(s).`)
console.log(`  → ${toMove.length} will be remapped to "${NEW}"`)
console.log(`  → ${links.length - toMove.length} already have "${NEW}" (link simply dropped)`)

if (!confirm) {
  console.log('\nDry run — nothing written. Re-run with --confirm to apply.')
  await prisma.$disconnect()
  process.exit(0)
}

await prisma.$transaction([
  ...toMove.map((l) => prisma.propertyAmenity.create({
    data: { propertyId: l.propertyId, amenityId: target.id },
  })),
  prisma.propertyAmenity.deleteMany({ where: { amenityId: old.id } }),
  prisma.amenity.delete({ where: { id: old.id } }),
])

console.log(`\n✓ Remapped ${toMove.length} listing(s) and removed the "${OLD}" amenity.`)
await prisma.$disconnect()
