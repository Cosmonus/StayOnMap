// Materialise the cells that listings actually sit in, before a visitor does.
//
// Track D of docs/spatial-research-2026-07-28.md. The 2026-07-28 probe found 5
// of 9 city-centre cells had never been computed: a read SCHEDULES
// materialisation and returns `pending`, so the first person to open a listing
// in a cold area gets the "not computed yet" panel and pays the latency for
// everyone after them.
//
// The refresher (refresher.js) already keeps computed cells FRESH. It does not
// warm cold ones — its query walks rows that already exist. This closes that
// gap, and deliberately as a script rather than another interval: warming is a
// thing you do after a seed or a deploy, not every five minutes forever.
//
// Usage:
//   node scripts/warm-spatial-cells.mjs                 # DRY RUN — reports what is cold
//   node scripts/warm-spatial-cells.mjs --confirm       # actually materialise
//   node scripts/warm-spatial-cells.mjs --city Chennai --confirm
//   node scripts/warm-spatial-cells.mjs --limit 50 --confirm
//
// Dry-run by default like every other script here, because materialising a
// cell can spend from the daily API budget (providers.js enforces the ceiling
// underneath, so this cannot overrun it — it can only exhaust it).
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { materialize } from '../src/features/spatial/spatial.service.js'
import { parseSeedArgs, flagValue, requireDatabaseUrl } from '../src/features/spatial/seedArgs.js'

const argv = process.argv.slice(2)
const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(argv)
// flagValue, not a hand-rolled indexOf: it already refuses to read the NEXT
// FLAG as a value, so `--limit --confirm` is "no limit given" rather than a
// limit of NaN that would silently warm nothing.
// Bounded by default — a first run against a large catalogue should not become
// an unattended hours-long job nobody chose to start.
const parsedLimit = Number(flagValue(argv, '--limit'))
const LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 200

// Between cells: materialisation can call out to Open-Meteo, OpenTopoData and
// (on a miss) Google. Pacing keeps a warm-up from looking like an attack.
const DELAY_MS = 500
requireDatabaseUrl()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // Property.geohash is the join key between a listing and the spatial layer
  // (.claude/spatial.md). NULL means "unknown cell" — those need
  // backfill-property-geohash.mjs, not this script, and are reported rather
  // than silently skipped.
  const listings = await prisma.property.findMany({
    where: {
      ...(ONLY_CITY ? { city: ONLY_CITY } : {}),
      // Warming a DRAFT or REJECTED listing's cell spends budget on a page
      // nobody can open.
      status: { in: ['ACTIVE', 'PENDING'] },
    },
    select: { geohash: true, city: true, type: true },
  })

  const missingGeohash = listings.filter((l) => !l.geohash).length
  const withGeohash = listings.filter((l) => l.geohash)

  // One cell can hold many listings — that is the whole point of cell-keying.
  // Warm each cell once, but remember every property TYPE in it: modules with
  // `variesByType` store a separate envelope per type, so a cell holding a plot
  // and a flat needs both.
  const cells = new Map()
  for (const l of withGeohash) {
    if (!cells.has(l.geohash)) cells.set(l.geohash, { city: l.city, types: new Set() })
    cells.get(l.geohash).types.add(l.type)
  }

  const known = await prisma.spatialContext.findMany({
    where: { geohash: { in: [...cells.keys()] } },
    select: { geohash: true },
  })
  const computed = new Set(known.map((k) => k.geohash))
  const cold = [...cells.entries()].filter(([g]) => !computed.has(g)).slice(0, LIMIT)

  console.log(`Listings considered:   ${listings.length}`)
  if (missingGeohash) {
    console.log(`  ⚠ ${missingGeohash} have no geohash — run backfill-property-geohash.mjs first;`)
    console.log('    a listing with no cell cannot be warmed and shows no spatial panel.')
  }
  console.log(`Distinct cells:        ${cells.size}`)
  console.log(`Already materialised:  ${computed.size}`)
  console.log(`Cold:                  ${cells.size - computed.size}${cold.length < cells.size - computed.size ? ` (warming ${cold.length}, --limit)` : ''}`)

  if (!cold.length) {
    console.log('\nNothing to warm.')
    await prisma.$disconnect()
    return
  }

  if (!CONFIRM) {
    for (const [geohash, { city, types }] of cold.slice(0, 20)) {
      console.log(`  ${geohash}  ${city ?? '?'}  [${[...types].join(', ')}]`)
    }
    if (cold.length > 20) console.log(`  …and ${cold.length - 20} more`)
    console.log('\nDRY RUN — nothing computed. Re-run with --confirm.')
    await prisma.$disconnect()
    return
  }

  let ok = 0
  let failed = 0
  for (const [i, [geohash, { types }]] of cold.entries()) {
    for (const type of types) {
      try {
        await materialize(geohash, type)
        ok++
      } catch (err) {
        // One bad cell must not end the run — the next visitor to every OTHER
        // cold cell is still better off.
        failed++
        console.warn(`  ${geohash} (${type}): FAILED — ${err.message}`)
      }
      await sleep(DELAY_MS)
    }
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${cold.length} cells`)
  }

  console.log(`\nWarmed ${ok} envelope(s)${failed ? `, ${failed} failed` : ''}.`)
  if (failed) {
    console.log('Failures are usually a provider being down; re-running converges.')
  }
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
