// PoiIndex → Place/PlaceSource — the OSM-only first pass of entity resolution.
//
// One canonical Place per real-world place, with a PlaceSource row recording
// OSM's view of it. Conflation uses features/spatial/places.js's match rule,
// which also self-dedupes OSM's own residual doubles (same shop mapped twice
// ~30 m apart). Idempotent: PlaceSource is unique on (source, sourceKey), so
// a re-run skips everything already ingested and only conflates new rows.
//
// Dry run by default — prints what it WOULD do. --confirm writes.
//   node scripts/backfill-places.mjs [--city Bengaluru] [--confirm]
import 'dotenv/config'
import { randomUUID } from 'crypto'
import { prisma } from '../src/lib/prisma.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { matchPlace } from '../src/features/spatial/places.js'

const { confirm, city: onlyCity } = parseSeedArgs(process.argv.slice(2))

// ~200 m grid so candidate lookup is O(1) per record, not O(n).
const CELL = 0.002
const gridKey = (lat, lng) => `${Math.round(lat / CELL)}:${Math.round(lng / CELL)}`

function* neighbours(grid, lat, lng) {
  const cy = Math.round(lat / CELL)
  const cx = Math.round(lng / CELL)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = grid.get(`${cy + dy}:${cx + dx}`)
      if (bucket) yield* bucket
    }
  }
}

async function backfillCity(city) {
  const [pois, existingKeys] = await Promise.all([
    prisma.poiIndex.findMany({
      where: { city },
      select: { osmId: true, category: true, name: true, lat: true, lng: true },
      orderBy: { osmId: 'asc' }, // deterministic: re-runs conflate in the same order
    }),
    prisma.placeSource.findMany({ where: { source: 'osm', place: { city } }, select: { sourceKey: true } }),
  ])
  const alreadyIngested = new Set(existingKeys.map((r) => r.sourceKey))

  // Per-category spatial grids of the Places built so far in this run —
  // conflation only ever compares within a category (the rule's precondition).
  // SEEDED from the places already in the DB for this city: a resumed run
  // (an interrupted first pass, or a later second-source ingestion) must
  // conflate against what exists, or every partner of an already-ingested row
  // becomes a duplicate Place.
  const grids = new Map()
  const existingPlaces = await prisma.place.findMany({
    where: { city },
    select: { id: true, name: true, category: true, lat: true, lng: true },
  })
  for (const p of existingPlaces) {
    if (!grids.has(p.category)) grids.set(p.category, new Map())
    const entry = { name: p.name, lat: Number(p.lat), lng: Number(p.lng), _existingId: p.id, _sources: [] }
    const grid = grids.get(p.category)
    const k = gridKey(entry.lat, entry.lng)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(entry)
  }
  const newPlaces = [] // { place, sourceRows }
  const attachToExisting = [] // sources that conflate onto a DB-existing place
  let attached = 0
  let skipped = 0

  for (const poi of pois) {
    if (alreadyIngested.has(poi.osmId)) { skipped++; continue }
    const record = { name: poi.name, lat: Number(poi.lat), lng: Number(poi.lng) }

    if (!grids.has(poi.category)) grids.set(poi.category, new Map())
    const grid = grids.get(poi.category)

    // Category passed explicitly: the grid is already per-category, so the
    // records carry no `category` field of their own and samePlace would
    // otherwise fall back to the tightest tier for everything.
    const match = matchPlace(record, [...neighbours(grid, record.lat, record.lng)], poi.category)
    if (match) {
      if (match._existingId) attachToExisting.push({ placeId: match._existingId, poi })
      else match._sources.push(poi)
      attached++
      continue
    }

    // Id generated HERE so the sources batch below can reference its place
    // without a returning-insert round trip — what makes createMany possible.
    const entry = { ...record, category: poi.category, city, _id: randomUUID(), _sources: [poi] }
    newPlaces.push(entry)
    const k = gridKey(record.lat, record.lng)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(entry)
  }

  console.log(
    `${city}: ${pois.length} PoiIndex rows → ${newPlaces.length} places ` +
    `(${attached} OSM doubles conflated, ${skipped} already ingested)` +
    (confirm ? '' : '  [dry run]')
  )
  if (!confirm) return

  // Batched writes: places first, then their sources referencing the
  // pre-generated ids — two createMany calls per chunk instead of a round
  // trip per row, which is what makes a WAN run to production take minutes
  // rather than hours. Order matters (FK); a kill between the two batches
  // leaves source-less places, which the resume pass conflates against
  // harmlessly and the sources arrive on the rerun via skipDuplicates.
  const CHUNK = 1000
  for (let i = 0; i < newPlaces.length; i += CHUNK) {
    const chunk = newPlaces.slice(i, i + CHUNK)
    await prisma.place.createMany({
      data: chunk.map((p) => ({
        id: p._id, name: p.name, category: p.category, lat: p.lat, lng: p.lng, city: p.city,
      })),
    })
    await prisma.placeSource.createMany({
      data: chunk.flatMap((p) =>
        p._sources.map((s) => ({
          placeId: p._id,
          source: 'osm',
          sourceKey: s.osmId,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          category: s.category,
        }))
      ),
      skipDuplicates: true,
    })
    process.stdout.write(`  wrote ${Math.min(i + CHUNK, newPlaces.length)}/${newPlaces.length}\r`)
  }
  if (newPlaces.length) process.stdout.write('\n')

  // Sources that matched a DB-existing place — flat rows, one batched insert.
  if (attachToExisting.length) {
    await prisma.placeSource.createMany({
      data: attachToExisting.map(({ placeId, poi }) => ({
        placeId,
        source: 'osm',
        sourceKey: poi.osmId,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category,
      })),
      skipDuplicates: true,
    })
    console.log(`  attached ${attachToExisting.length} sources to existing places`)
  }
}

const cities = onlyCity
  ? [onlyCity]
  : (await prisma.poiIndex.findMany({ select: { city: true }, distinct: ['city'] })).map((r) => r.city)

for (const city of cities) await backfillCity(city)

const [places, sources] = await Promise.all([prisma.place.count(), prisma.placeSource.count()])
console.log(`Totals now: ${places} places, ${sources} source records`)
await prisma.$disconnect()
