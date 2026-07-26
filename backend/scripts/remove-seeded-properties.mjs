#!/usr/bin/env node
// Removes the LISTINGS created by the seed scripts, and nothing else.
//
// Keeps: every user account (including the test1/test2 logins and their
// passwords), the admin, the 70 seeded amenities, and the whole spatial layer
// (PoiIndex / Boundary / SpatialContext). Those are reference data and
// credentials, not demo content — deleting amenities would break listing
// creation, and the POI index cost a real incident to restore once already.
//
// It matches by TITLE against the two seed fixtures, never "delete all
// properties": a real listing someone typed by hand must survive this, and on
// production that is the difference between a cleanup and an outage. Anything
// in the database that does NOT match is listed as "left alone" so the
// difference is visible rather than assumed.
//
// Dry run (default) — prints what would go, deletes nothing:
//   node --env-file=.env scripts/remove-seeded-properties.mjs
// Actually delete:
//   node --env-file=.env scripts/remove-seeded-properties.mjs --confirm
// Against production (never commit the URL, never print it):
//   DATABASE_URL='...' node scripts/remove-seeded-properties.mjs --confirm
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../src/lib/prisma.js'

const confirm = process.argv.includes('--confirm')
const here = dirname(fileURLToPath(import.meta.url))

// Read the titles out of the fixtures themselves rather than restating them —
// a hardcoded copy here would drift the moment someone edits a seed.
function titlesFrom(file, pattern) {
  const src = readFileSync(join(here, '..', file), 'utf8')
  return [...src.matchAll(pattern)].map((m) => m[1])
}

const seedTitles = titlesFrom('prisma/seed.js', /^\s*title:\s*'([^']+)'/gm)
const demoTitles = titlesFrom('scripts/seed-test-accounts.mjs', /^\s*title:\s*'([^']+)'/gm)
const titles = [...new Set([...seedTitles, ...demoTitles])]

if (titles.length === 0) {
  console.error('✗ No seed titles found — refusing to run rather than guess at a match.')
  process.exit(1)
}

const [doomed, survivors] = await Promise.all([
  prisma.property.findMany({
    where: { title: { in: titles } },
    select: { id: true, title: true, status: true, owner: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  }),
  prisma.property.findMany({
    where: { title: { notIn: titles } },
    select: { title: true, status: true, owner: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  }),
])

console.log(`Seed fixtures define ${titles.length} distinct titles ` +
  `(${seedTitles.length} from prisma/seed.js, ${demoTitles.length} from seed-test-accounts.mjs)\n`)

console.log(`Would DELETE ${doomed.length} listing(s):`)
for (const p of doomed) console.log(`  · ${p.title}  [${p.status}]  — ${p.owner?.email ?? 'no owner'}`)

console.log(`\nWould KEEP ${survivors.length} listing(s) that match no fixture:`)
for (const p of survivors) console.log(`  · ${p.title}  [${p.status}]  — ${p.owner?.email ?? 'no owner'}`)
if (survivors.length === 0) console.log('  (none)')

console.log('\nAccounts, admin, amenities and spatial data are untouched either way.')

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

// Images, amenities, rules, appointments, conversations, scores and saves all
// cascade from Property (onDelete: Cascade in schema.prisma).
const { count } = await prisma.property.deleteMany({ where: { id: { in: doomed.map((p) => p.id) } } })
console.log(`\nDone: deleted ${count} listing(s) and everything cascading from them.`)
await prisma.$disconnect()
