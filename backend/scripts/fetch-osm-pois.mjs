#!/usr/bin/env node
// Seed PoiIndex from OpenStreetMap via the Overpass API.
//
// This is the change that stops the spatial layer renting facts from Google.
// Places Nearby is metered per request and the layer needs ~9 per cell; the
// same question asked of a local table is one indexed bbox scan and costs
// nothing per call, forever.
//
// A developer-machine operation, not a runtime one — same category as
// scripts/seed-amenities.mjs. Listed in docs/operator-actions.md.
//
//   node scripts/fetch-osm-pois.mjs                    # dry run, all cities
//   node scripts/fetch-osm-pois.mjs --city Bengaluru   # dry run, one city
//   node scripts/fetch-osm-pois.mjs --confirm          # actually write
//
// Dry-run by default, following scripts/dedupe-metro-paths.mjs's precedent:
// this writes hundreds of thousands of rows, and "I meant to check first" is a
// bad thing to discover afterwards.
//
// Re-runnable: rows are keyed on osmId, so a second run updates in place
// rather than duplicating the dataset. Quarterly is a sensible cadence.
import 'dotenv/config'
// The singleton, not a fresh PrismaClient — Prisma 7 needs an explicit driver
// adapter and lib/prisma.js is where that's configured (see .claude/database.md).
import { prisma } from '../src/lib/prisma.js'
import { removeStalePois, invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'
import { categoryFor, overpassClauses, CATEGORY_KEYS } from '../src/features/spatial/poiCategories.js'

// Public instances, tried in order. The main one has 406'd from some
// environments before (see .claude/roadmap.md Addenda 10-11), so the mirrors
// are a real fallback path rather than defensive padding.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const REQUEST_TIMEOUT_MS = 180_000
// Overpass is a free service run on donated hardware. A pause between tiles is
// the cost of being allowed to keep using it.
const DELAY_BETWEEN_TILES_MS = 2_000
// Each city is split into a grid of tiles. A single query over Delhi's full
// ~120km box returns enough restaurants to hit Overpass's memory ceiling and
// time out; tiling keeps every request small and makes a failure cost one tile
// rather than a city.
const TILE_GRID = 4
// How many upserts are in flight at once. NOT a transaction size — see
// writeRows. Kept modest so a remote database over a TCP proxy isn't flooded
// beyond its connection pool, while still pipelining enough to matter: one
// round trip at a time would take hours for a city like Delhi.
const WRITE_CONCURRENCY = 25

const args = process.argv.slice(2)
const CONFIRM = args.includes('--confirm')

// Read the value only when the flag is actually present. `indexOf` returns -1
// when it isn't, and `args[-1 + 1]` is `args[0]` — so a bare `--confirm` was
// being read as a city named "confirm".
const cityFlag = args.indexOf('--city')
const ONLY_CITY = cityFlag !== -1 && args[cityFlag + 1] && !args[cityFlag + 1].startsWith('--')
  ? args[cityFlag + 1]
  : null


function bboxFor({ lat, lng, radiusKm }) {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng }
}

function tiles(bbox, n) {
  const out = []
  const latStep = (bbox.north - bbox.south) / n
  const lngStep = (bbox.east - bbox.west) / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out.push({
        south: bbox.south + i * latStep,
        north: bbox.south + (i + 1) * latStep,
        west: bbox.west + j * lngStep,
        east: bbox.west + (j + 1) * lngStep,
      })
    }
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function overpass(query) {
  let lastError = null
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass asks for an identifiable agent so it can contact abusers
          // rather than silently blocking them.
          'User-Agent': 'StayOnMap/1.0 (spatial intelligence POI seed; https://www.stayonmap.com)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) { lastError = new Error(`${endpoint} → HTTP ${res.status}`); continue }
      return await res.json()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('all Overpass endpoints failed')
}

function elementsToRows(elements) {
  const rows = []
  for (const el of elements) {
    const category = categoryFor(el.tags ?? {})
    if (!category) continue

    // Ways and relations come back with a `center` because the query asks for
    // `out center`. Nodes carry lat/lng directly.
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    // City from the actual coordinate, not the city being fetched: the fetch
    // bbox is a SQUARE around the city's circular radius, so its corners hold
    // POIs that resolveCity() — the same function the query layer uses — says
    // are outside every supported city. Stamping those with the fetched city
    // made seed-time and query-time disagree about coverage; dropping them
    // keeps the two consistent.
    const city = resolveCity(lat, lng)?.city
    if (!city) continue

    rows.push({
      osmId: `${el.type}/${el.id}`,
      category,
      name: el.tags?.name ?? null,
      // Straight from OSM where a mapper recorded them — sparse, and shown to
      // users only when present. brand falls back to operator so "ICICI"
      // matches a branch whose name tag is bare.
      brand: el.tags?.brand ?? el.tags?.operator ?? null,
      openingHours: el.tags?.opening_hours ?? null,
      lat, lng, city,
    })
  }
  return rows
}

async function writeRows(rows) {
  // createMany + skipDuplicates would leave stale rows behind forever, so a
  // refetch would never correct a POI that moved or closed. Upserts converge.
  //
  // Deliberately NOT wrapped in prisma.$transaction. It used to be, in batches
  // of 500, and that made the script unable to seed a REMOTE database at all:
  // Prisma caps a transaction at 5s, and 500 upserts over the Railway TCP
  // proxy take longer than that from a laptop (observed: 7.07s → P2028). The
  // transaction bought nothing anyway — every upsert is independent and keyed
  // on osmId, so a half-finished run converges on re-run, and the stale-row
  // deletion is already gated on a fully-successful FETCH, so a partial write
  // can never turn live rows into ghosts.
  const fetchedAt = new Date()
  let done = 0

  for (let i = 0; i < rows.length; i += WRITE_CONCURRENCY) {
    const batch = rows.slice(i, i + WRITE_CONCURRENCY)
    await Promise.all(batch.map((row) => prisma.poiIndex.upsert({
      where: { osmId: row.osmId },
      create: { ...row, fetchedAt },
      update: {
        category: row.category, name: row.name, brand: row.brand,
        openingHours: row.openingHours, lat: row.lat, lng: row.lng,
        city: row.city, fetchedAt,
      },
    })))
    done += batch.length
    process.stdout.write(`    written ${done}/${rows.length}\r`)
  }
  process.stdout.write('\n')
}

async function fetchTile(tile, seen) {
  const query = `[out:json][timeout:170];\n(\n  ${overpassClauses(tile)}\n);\nout center tags;`
  const data = await overpass(query)
  const rows = elementsToRows(data.elements ?? [])
  for (const row of rows) seen.set(row.osmId, row)
  return rows.length
}

async function fetchCity(city) {
  const bbox = bboxFor(CITY_CENTERS[city])
  const grid = tiles(bbox, TILE_GRID)
  const seen = new Map() // osmId → row; tiles share edges, so dedupe here
  // Everything already in the table that this complete fetch does not return
  // is a ghost — demolished, retagged out of the vocabulary, or re-mapped
  // under a new osmId. Captured BEFORE the tiles run so nothing written by
  // this run can match its own deletion cutoff.
  const runStart = new Date()
  const failedTiles = []

  console.log(`\n${city} — ${grid.length} tiles`)

  for (const [i, tile] of grid.entries()) {
    try {
      const matched = await fetchTile(tile, seen)
      console.log(`  tile ${i + 1}/${grid.length}: ${matched} matched (${seen.size} unique so far)`)
    } catch (err) {
      failedTiles.push(tile)
      console.warn(`  tile ${i + 1}/${grid.length}: FAILED — ${err.message}`)
    }
    if (i < grid.length - 1) await sleep(DELAY_BETWEEN_TILES_MS)
  }

  // One retry pass for dead tiles before declaring a coverage gap — Overpass
  // mirrors fail transiently far more often than persistently, and a
  // silently-thin area is exactly the "is it missing or is it not mapped"
  // ambiguity the layer warns about.
  let failed = 0
  if (failedTiles.length) {
    console.log(`  retrying ${failedTiles.length} failed tile(s)…`)
    for (const tile of failedTiles) {
      await sleep(DELAY_BETWEEN_TILES_MS)
      try {
        const matched = await fetchTile(tile, seen)
        console.log(`  retry: ${matched} matched (${seen.size} unique so far)`)
      } catch (err) {
        failed++
        console.warn(`  retry FAILED — ${err.message}`)
      }
    }
  }

  const rows = [...seen.values()]
  const byCategory = {}
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1

  console.log(`  → ${rows.length} POIs${failed ? `, ${failed} tile(s) failed` : ''}`)
  for (const key of CATEGORY_KEYS) {
    if (byCategory[key]) console.log(`      ${key.padEnd(14)} ${byCategory[key]}`)
  }
  const empty = CATEGORY_KEYS.filter((k) => !byCategory[k])
  if (empty.length) console.log(`      (no data: ${empty.join(', ')})`)

  if (CONFIRM && rows.length) {
    await writeRows(rows)

    // Ghost removal — ONLY after a fully-successful fetch. With a failed tile
    // the rows it would have refreshed are indistinguishable from ghosts, and
    // deleting real coverage is worse than keeping a stale row for a cycle.
    if (failed === 0) {
      const removed = await removeStalePois(city, runStart)
      if (removed) console.log(`  removed ${removed} stale row(s) no longer present in OSM`)
    } else {
      console.log('  skipping stale-row removal — coverage incomplete, re-run to converge')
    }

    // The data under every computed cell in this city just changed. Without
    // this, cells keep serving pre-seed answers for their full module TTLs
    // (up to 60 days) — the refresher only looks at staleAfter/version.
    const invalidated = await invalidateCityCells(city, runStart)
    console.log(`  marked ${invalidated} spatial cell(s) stale — the refresher will recompute them`)

    // The receipt. `complete: false` on a failed tile is what stops a thin
    // result being read later as "this city just doesn't have many shops".
    const namedPct = completeness(rows, ['name'])
    await recordQualityReport({
      dataset: 'poi_index',
      scope: city,
      recordCount: rows.length,
      completenessPct: namedPct,
      complete: failed === 0,
      notes: { byCategory, failedTiles: failed, tilesPlanned: grid.length, emptyCategories: empty },
    })
    if (namedPct != null) console.log(`  ${namedPct}% carry a name`)
  }
  return { city, count: rows.length, failed }
}

async function main() {
  const cities = ONLY_CITY ? [ONLY_CITY] : Object.keys(CITY_CENTERS)

  for (const city of cities) {
    if (!CITY_CENTERS[city]) {
      console.error(`Unknown city: ${city}. Known: ${Object.keys(CITY_CENTERS).join(', ')}`)
      process.exit(1)
    }
  }

  console.log(CONFIRM
    ? `Writing PoiIndex for: ${cities.join(', ')}`
    : `DRY RUN (no writes) for: ${cities.join(', ')} — pass --confirm to write`)

  const results = []
  for (const city of cities) results.push(await fetchCity(city))

  const total = results.reduce((s, r) => s + r.count, 0)
  const failedTiles = results.reduce((s, r) => s + r.failed, 0)
  console.log(`\nTotal: ${total} POIs across ${results.length} cities`)
  if (failedTiles) console.log(`⚠ ${failedTiles} tile(s) failed — coverage is incomplete; re-run to fill the gaps`)
  if (!CONFIRM) console.log('Nothing was written. Re-run with --confirm.')

  await prisma.$disconnect()
  // Explicit exit — same reason as fetch-osm-boundaries.mjs: seedMaintenance
  // imports lib/redis.js, and an open Redis connection keeps the event loop
  // alive after main() returns, leaving a done-but-zombie process. All writes
  // above are awaited; nothing is lost by exiting here.
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
