#!/usr/bin/env node
// Build SIMILAR_TO edges for listings that already existed.
//
// WHY THIS IS NEEDED, despite similarity being "self-building". Edges are
// computed on three triggers — a listing is created, edited in a way the scorer
// reads, or moved in/out of ACTIVE by moderation. An ALREADY-ACTIVE listing hits
// none of them. Without this script every listing that predates the feature has
// no neighbours until somebody happens to edit it, which for a live listing may
// be never. The operator doc briefly claimed no backfill was needed; it was
// wrong, and this is the correction.
//
// DRY RUN BY DEFAULT. Pass --confirm to write.
//
//   node --env-file=.env scripts/backfill-similarity.mjs
//   node --env-file=.env scripts/backfill-similarity.mjs --confirm
//
// On the VM the env is /etc/stayonmap/api.env, not a local file — see
// .claude/ops.md:
//   DATABASE_URL=... node scripts/backfill-similarity.mjs --confirm
//
// Re-runnable and idempotent: refreshSimilarity() replaces a listing's edges
// wholesale, so running it twice produces the same rows.
//
// COST. One candidate scan per listing, sequential. That is O(n²) overall, which
// is fine at hundreds of listings and is the reason this is a script rather than
// something that runs on boot. Past a few thousand, add a bbox prefilter to the
// candidate query in similarity.js — the same shape the POI scan uses — before
// running this again.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { refreshSimilarity, TOP_K } from '../src/features/graph/similarity.js'

const confirm = process.argv.includes('--confirm')

async function main() {
  // ACTIVE only, in both directions: the scorer only ever considers ACTIVE
  // candidates, so computing edges FOR a draft would produce rows nobody can
  // read. Drafts get theirs when they are published.
  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, title: true, type: true, city: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`${properties.length} ACTIVE listing(s).`)
  if (!properties.length) return

  const existing = await prisma.propertySimilarity.groupBy({
    by: ['propertyId'],
    _count: { _all: true },
  })
  const already = new Map(existing.map((r) => [r.propertyId, r._count._all]))
  console.log(`${already.size} already have edges; ${properties.length - already.size} have none.\n`)

  if (!confirm) {
    // A dry run must not compute, because computing IS writing here —
    // refreshSimilarity replaces rows as its whole job. So the preview reports
    // what it would process rather than what it would find, and says so.
    for (const p of properties) {
      const count = already.get(p.id) ?? 0
      console.log(`  ${count ? `${String(count).padStart(2)} edges` : '  no edges'}  ${p.type.padEnd(10)} ${p.city.padEnd(12)} ${p.title.slice(0, 48)}`)
    }
    console.log(`\nDRY RUN — nothing computed or written.`)
    console.log(`Re-run with --confirm to build up to ${TOP_K} neighbours per listing.`)
    return
  }

  let withNeighbours = 0
  let alone = 0

  for (const p of properties) {
    const count = await refreshSimilarity(p.id)
    if (count > 0) withNeighbours++
    else alone++
    console.log(`  ${String(count).padStart(2)} neighbour(s)  ${p.type.padEnd(10)} ${p.title.slice(0, 48)}`)
  }

  console.log(`\n${withNeighbours} listing(s) with neighbours, ${alone} with none.`)
  // Zero neighbours is a legitimate outcome, not a failure: the only plot in a
  // city has nothing comparable, and saying so is the point of the type gate.
  if (alone) {
    console.log('A listing with no neighbours is usually the only one of its type,')
    console.log('pricing model, or area — not an error. Check one before assuming otherwise.')
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
