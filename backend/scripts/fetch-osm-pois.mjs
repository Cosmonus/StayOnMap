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
import { markAbsentPois, reviveReturnedPois, invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { detectConflicts, validateCoordinate } from '../src/features/spatial/poiConflicts.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'
import { classify, overpassClauses, CATEGORY_KEYS } from '../src/features/spatial/poiCategories.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { bboxFor, tiles } from '../src/features/spatial/tiling.js'
import { overpassQuery } from '../src/features/spatial/overpassClient.js'

// Public instances, tried in order. The main one has 406'd from some
// environments before (see .claude/roadmap.md Addenda 10-11), so the mirrors
// are a real fallback path rather than defensive padding.
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
// How many rows we look up at once to compare against what is already stored.
// One indexed `IN` over osmId per chunk, which is what makes conflict detection
// cost a handful of queries per city rather than one per row.
const COMPARE_CHUNK = 1000
// The source name recorded on every conflict this script raises. A literal
// rather than a parameter: this file only ever ingests OpenStreetMap, and a
// configurable value here would be a knob with one setting.
const SOURCE = 'osm'

const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(process.argv.slice(2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const overpass = (query) => overpassQuery(query, {
  userAgent: 'StayOnMap/1.0 (spatial intelligence POI seed; https://www.stayonmap.com)',
  timeoutMs: REQUEST_TIMEOUT_MS,
})

// Coordinates rejected by validation, per run. Reported in the quality report
// rather than only counted: a spike here means an upstream parse changed, and a
// number nobody records is a number nobody notices moving.
const rejected = { total: 0, byReason: {} }

function elementsToRows(elements) {
  const rows = []
  for (const el of elements) {
    const match = classify(el.tags ?? {})
    if (!match) continue
    const { category, sourceTag } = match

    // Ways and relations come back with a `center` because the query asks for
    // `out center`. Nodes carry lat/lng directly.
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    // Spatial validation before anything else touches this row. `resolveCity`
    // below already drops most bad coordinates, but it reports them all the same
    // way — as "outside every supported city" — so a NaN and a (0, 0) and a
    // genuine POI in Nagpur were indistinguishable. They are different problems:
    // the first two mean something upstream broke.
    const check = validateCoordinate(lat, lng)
    if (!check.valid) {
      rejected.total++
      rejected.byReason[check.reason] = (rejected.byReason[check.reason] ?? 0) + 1
      continue
    }

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
      // Which OSM tag produced this category. Makes a suspected mis-mapping
      // measurable against stored rows instead of requiring a re-fetch to
      // investigate — see PoiIndex.sourceTag.
      sourceTag,
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

/**
 * Retire any still-OPEN conflict on the same (POI, attribute) pairs we are
 * about to raise a new one for.
 *
 * Without this the review queue accumulates one row per re-seed for a place
 * whose coordinate wobbles across the threshold every quarter, and the oldest —
 * least relevant — entry looks exactly as actionable as today's. Grouped by
 * attribute so it is one statement per attribute rather than one per POI.
 */
async function supersedeOpenConflicts(conflictRows) {
  const byAttribute = new Map()
  for (const c of conflictRows) {
    if (!byAttribute.has(c.attribute)) byAttribute.set(c.attribute, [])
    byAttribute.get(c.attribute).push(c.poiIndexId)
  }
  for (const [attribute, ids] of byAttribute) {
    await prisma.poiConflict.updateMany({
      where: { poiIndexId: { in: ids }, attribute, status: 'OPEN' },
      data: { status: 'SUPERSEDED', resolvedAt: new Date(), resolution: 'a later fetch conflicted on the same attribute' },
    })
  }
}

async function writeRows(rows) {
  // createMany + skipDuplicates would leave stale rows behind forever, so a
  // refetch would never correct a POI that moved or closed. Upserts converge.
  //
  // Deliberately NOT wrapped in prisma.$transaction. It used to be, in batches
  // of 500, and that made the script unable to seed a REMOTE database at all:
  // Prisma caps a transaction at 5s, and 500 upserts over a remote database
  // connection take longer than that from a laptop (observed: 7.07s → P2028). The
  // transaction bought nothing anyway — every upsert is independent and keyed
  // on osmId, so a half-finished run converges on re-run, and the stale-row
  // marking is already gated on a fully-successful FETCH, so a partial write
  // can never turn live rows into ghosts.
  const fetchedAt = new Date()
  let done = 0
  const conflicts = { total: 0, withheld: 0, byAttribute: {} }

  for (let start = 0; start < rows.length; start += COMPARE_CHUNK) {
    const chunk = rows.slice(start, start + COMPARE_CHUNK)

    // What we already hold for these osmIds. One indexed IN per chunk — this is
    // the read that turns a blind overwrite into a comparison. Rows with no
    // match are genuinely new and cannot conflict with anything.
    const stored = await prisma.poiIndex.findMany({
      where: { osmId: { in: chunk.map((r) => r.osmId) } },
      select: { id: true, osmId: true, category: true, name: true, lat: true, lng: true },
    })
    const byOsmId = new Map(stored.map((r) => [r.osmId, r]))

    // Resolve BEFORE writing. detectConflicts returns both the findings and the
    // row to write, because a withheld coordinate must not reach the database —
    // deciding that in one place is what stops the write path and the audit
    // trail describing different outcomes.
    const prepared = chunk.map((row) => {
      const prev = byOsmId.get(row.osmId) ?? null
      const { conflicts: found, resolved } = detectConflicts(prev, row, { source: SOURCE })
      return { row: resolved, prev, found }
    })

    for (let i = 0; i < prepared.length; i += WRITE_CONCURRENCY) {
      const batch = prepared.slice(i, i + WRITE_CONCURRENCY)
      await Promise.all(batch.map(({ row }) => prisma.poiIndex.upsert({
        where: { osmId: row.osmId },
        // firstSeenAt only on create — it is the one timestamp that must never
        // move. Older rows keep NULL rather than being handed a guess.
        create: { ...row, fetchedAt, firstSeenAt: fetchedAt },
        update: {
          category: row.category, sourceTag: row.sourceTag,
          name: row.name, brand: row.brand,
          openingHours: row.openingHours, lat: row.lat, lng: row.lng,
          city: row.city, fetchedAt,
          // `status` is deliberately NOT set here. A row returning from absence
          // is revived by reviveReturnedPois after the write, so the transition
          // gets a PoiStatusEvent — setting it inline would flip the column and
          // lose the fact that it ever went away, which is the whole point.
        },
      })))
      done += batch.length
      process.stdout.write(`    written ${done}/${rows.length}\r`)
    }

    const conflictRows = prepared.flatMap(({ prev, found }) =>
      found.map((c) => ({ ...c, poiIndexId: prev.id }))
    )
    if (conflictRows.length) {
      await supersedeOpenConflicts(conflictRows)
      await prisma.poiConflict.createMany({ data: conflictRows })
      for (const c of conflictRows) {
        conflicts.total++
        if (!c.applied) conflicts.withheld++
        conflicts.byAttribute[c.attribute] = (conflicts.byAttribute[c.attribute] ?? 0) + 1
      }
    }
  }
  process.stdout.write('\n')
  return conflicts
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

  // Per city, not per run — the quality report is city-scoped, and a counter
  // that carried over would attribute Delhi's bad coordinates to Surat.
  rejected.total = 0
  rejected.byReason = {}

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
  // Printed on a DRY RUN too — a validation failure is worth seeing before
  // deciding whether to write, which is what a dry run is for.
  if (rejected.total) {
    const why = Object.entries(rejected.byReason).map(([r, n]) => `${n} ${r}`).join('; ')
    console.log(`      ${rejected.total} coordinate(s) rejected — ${why}`)
  }
  for (const key of CATEGORY_KEYS) {
    if (byCategory[key]) console.log(`      ${key.padEnd(14)} ${byCategory[key]}`)
  }
  const empty = CATEGORY_KEYS.filter((k) => !byCategory[k])
  if (empty.length) console.log(`      (no data: ${empty.join(', ')})`)

  if (CONFIRM && rows.length) {
    const conflicts = await writeRows(rows)

    if (conflicts.total) {
      const detail = Object.entries(conflicts.byAttribute)
        .map(([k, v]) => `${k} ${v}`).join(', ')
      console.log(`  ${conflicts.total} conflict(s) recorded (${detail})`)
      if (conflicts.withheld) {
        console.log(`    ${conflicts.withheld} implausible move(s) WITHHELD — stored coordinates kept`)
      }
    }

    // A place that had gone missing and is back in this fetch. Written before
    // the absence pass so the two cannot fight over the same row: revival looks
    // at what this run touched, absence at what it did not.
    const revived = await reviveReturnedPois(city, runStart)
    if (revived) console.log(`  ${revived} POI(s) returned to OSM and are live again`)

    // Ghosts — ONLY after a fully-successful fetch. With a failed tile the rows
    // it would have refreshed are indistinguishable from genuinely-absent ones,
    // and hiding real coverage is worse than keeping a stale row for a cycle.
    //
    // These are MARKED, not deleted (since 2026-08-11). The serving path filters
    // on status so nothing user-facing changes; what changes is that a closure
    // is now a fact we hold rather than one we destroy.
    if (failed === 0) {
      const absent = await markAbsentPois(city, runStart)
      if (absent) console.log(`  marked ${absent} POI(s) absent from OSM (kept, not deleted)`)
    } else {
      console.log('  skipping absence marking — coverage incomplete, re-run to converge')
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
      notes: {
        byCategory, failedTiles: failed, tilesPlanned: grid.length, emptyCategories: empty,
        // The three numbers that make this run auditable after the fact.
        // `rejected` is a spatial-validation failure count; `conflicts` is how
        // much the source disagreed with what we held; `withheld` is how often
        // we declined to believe it. All three were previously invisible.
        rejectedCoordinates: rejected.total,
        rejectedByReason: rejected.byReason,
        conflicts: conflicts.total,
        conflictsByAttribute: conflicts.byAttribute,
        conflictsWithheld: conflicts.withheld,
      },
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
