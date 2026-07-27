#!/usr/bin/env node
// Deletes LISTINGS, keeping the ones you name by displayId.
//
// Sibling of remove-seeded-properties.mjs, which matches seeded titles and is
// the safe choice for clearing demo content. This one is the blunt instrument:
// it deletes everything you do not explicitly keep, so it exists mainly to make
// that operation survivable.
//
// Keeps regardless: every user account, the admin, the seeded amenities, and
// the whole spatial layer (PoiIndex / Boundary / SpatialContext). Those are
// credentials and reference data, not content.
//
//   Dry run (default) — prints what would go, deletes nothing:
//     node --env-file=.env scripts/delete-properties.mjs --keep=HSE-1234567890123456
//   Actually delete:
//     node --env-file=.env scripts/delete-properties.mjs --keep=HSE-... --confirm
//   Delete EVERY listing (must be spelled out; --keep with no value will not do it):
//     node --env-file=.env scripts/delete-properties.mjs --all --confirm
//   Against production (never commit the URL, never print it):
//     DATABASE_URL='...' node scripts/delete-properties.mjs --keep=HSE-... --confirm
import { prisma } from '../src/lib/prisma.js'

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const deleteAll = args.includes('--all')
const keep = args
  .filter((a) => a.startsWith('--keep='))
  .map((a) => a.slice('--keep='.length).trim())
  .filter(Boolean)

if (!keep.length && !deleteAll) {
  console.error('✗ Nothing to keep and --all not given.')
  console.error('  Pass --keep=DISPLAYID (repeatable), or --all to delete every listing.')
  process.exit(1)
}

const all = await prisma.property.findMany({
  select: {
    id: true, displayId: true, title: true, status: true, city: true,
    owner: { select: { email: true } },
    _count: { select: { appointments: true, conversations: true, leases: true, reviews: true, reports: true, images: true } },
  },
  orderBy: { createdAt: 'asc' },
})

console.log(`Database holds ${all.length} listing(s).\n`)

// THE GUARD. A --keep that matches nothing is almost always a typo or an id
// from another environment, and silently treating it as "keep nothing" turns
// "delete all but one" into "delete everything". Refuse instead: a wrong id
// should cost you a rerun, not the listing you were trying to protect.
const known = new Set(all.map((p) => p.displayId))
const missing = keep.filter((k) => !known.has(k))
if (missing.length) {
  console.error(`✗ These --keep ids are not in this database: ${missing.join(', ')}`)
  console.error('  Refusing to run — a keeper that matches nothing would delete it too.')
  console.error('\n  Listings that DO exist here:')
  for (const p of all) console.error(`    ${p.displayId}  [${p.status}]  ${p.city}  — ${p.title}`)
  await prisma.$disconnect()
  process.exit(1)
}

const doomed = all.filter((p) => !keep.includes(p.displayId))
const survivors = all.filter((p) => keep.includes(p.displayId))

const totals = doomed.reduce((acc, p) => {
  for (const [k, v] of Object.entries(p._count)) acc[k] = (acc[k] ?? 0) + v
  return acc
}, {})

console.log(`Would DELETE ${doomed.length} listing(s):`)
for (const p of doomed) {
  console.log(`  · ${p.displayId}  [${p.status}]  ${p.city}  — ${p.title}`)
  console.log(`      ${p._count.images} image(s), ${p._count.appointments} visit(s), ` +
    `${p._count.conversations} thread(s), ${p._count.leases} lease(s), ` +
    `${p._count.reviews} review(s), ${p._count.reports} report(s)`)
}
if (!doomed.length) console.log('  (none)')

console.log(`\nWould KEEP ${survivors.length} listing(s):`)
for (const p of survivors) console.log(`  · ${p.displayId}  [${p.status}]  ${p.city}  — ${p.title}`)
if (!survivors.length) console.log('  (none — every listing goes)')

console.log('\nCascading with them, in total: ' +
  Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing')
console.log('Accounts, admin, amenities and spatial data are untouched either way.')

// Conversations cascade, but the NOTIFICATIONS that point at them do not —
// Notification.referenceId is a plain string with no foreign key. Deleting
// listings therefore strands every message and appointment notification that
// referenced them, and tapping one opens a thread that cannot load. This has
// already happened once on this project. Clearing them is a separate call
// because a notification is not owned by the property.
const strandable = await prisma.notification.count({
  where: { referenceType: { in: ['Conversation', 'Appointment', 'Lease', 'Property'] } },
})
console.log(`\n⚠ ${strandable} notification(s) reference a conversation, visit, lease or property.`)
console.log('  Notification.referenceId has no foreign key, so those do NOT cascade.')
console.log('  Any that pointed at a deleted listing will open a dead screen until pruned.')

if (!doomed.length) {
  console.log('\nNothing to delete.')
  await prisma.$disconnect()
  process.exit(0)
}

if (!confirm) {
  console.log('\nDry run only — rerun with --confirm to actually delete.')
  await prisma.$disconnect()
  process.exit(0)
}

const { count } = await prisma.property.deleteMany({ where: { id: { in: doomed.map((p) => p.id) } } })
console.log(`\nDone: deleted ${count} listing(s) and everything cascading from them.`)
await prisma.$disconnect()
