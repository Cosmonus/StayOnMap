// Seed WaterBody — lakes, rivers, tanks, reservoirs and canals as polygons.
//
// Closes `water_distance`, the only declared-but-absent input shared by two
// modules (terrain and environment). See docs/spatial-research-2026-07-28.md.
//
// Usage:
//   node scripts/fetch-osm-water.mjs                    # DRY RUN, writes nothing
//   node scripts/fetch-osm-water.mjs --confirm          # actually write
//   node scripts/fetch-osm-water.mjs --city Chennai     # one city
//
// House rules this follows, all of which exist because breaking one of them
// caused a real incident (see .claude/ops.md):
//   - dry-run by default
//   - keyed on osmId, so a re-run converges instead of duplicating
//   - stale rows deleted ONLY after a fully successful fetch
//   - files a DataQualityReport, so "this area is sparse" stays distinguishable
//     from "we failed to fetch it"
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { assembleRings, ringsToGeometry, bboxOf } from '../src/features/spatial/boundaryGeometry.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { bboxFor, tiles } from '../src/features/spatial/tiling.js'
import { overpassQuery } from '../src/features/spatial/overpassClient.js'
import { MIN_AREA_SQM } from '../src/features/spatial/waterLookup.js'

const REQUEST_TIMEOUT_MS = 240_000
const DELAY_BETWEEN_TILES_MS = 2_000
// 3x3 = 9 tiles per city. Discovered the hard way on 2026-07-28: a city bbox is
// a 35 km RADIUS, i.e. a ~70 km square, and one query over that asking for ways
// AND relations with full member geometry does not come back. A 100x smaller
// test box answered in 1.9 s. Overpass is fine; the query was not.
const TILE_GRID = 3
const DEG_LAT_M = 111_320

const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(process.argv.slice(2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const overpass = (query) => overpassQuery(query, { timeoutMs: REQUEST_TIMEOUT_MS })

// One selector set, applied per TILE. `waterway=river` is deliberately absent:
// it is a LINE (a centreline), and this table stores areas — a line has zero
// width and a meaningless bbox. `riverbank` is the river's area.
const SELECTORS = [
  'way["natural"="water"]', 'relation["natural"="water"]',
  'way["landuse"="reservoir"]', 'relation["landuse"="reservoir"]',
  'way["waterway"="riverbank"]', 'relation["waterway"="riverbank"]',
]

// OSM's water vocabulary is much larger than ours. Map down to the six kinds a
// reader would actually notice a difference between, and DROP anything we
// cannot place rather than guessing — an unknown tag becoming "lake" is how a
// sewage treatment pond ends up advertised as a water feature.
function kindOf(tags) {
  const water = tags.water
  const waterway = tags.waterway
  const landuse = tags.landuse

  if (waterway === 'riverbank' || water === 'river') return 'river'
  if (water === 'canal' || waterway === 'canal') return 'canal'
  if (landuse === 'reservoir' || water === 'reservoir') return 'reservoir'
  if (water === 'lake' || water === 'oxbow') return 'lake'
  if (water === 'pond') return 'pond'
  // "tank" is the standard South Indian term for an engineered water body and
  // is tagged both ways.
  if (water === 'basin' || tags.name?.match(/\btank\b/i)) return 'tank'
  // natural=water with no `water=` subtag is overwhelmingly a lake in Indian
  // mapping, and it is the single most common case. This is the one inference
  // made here, and it is made only for that exact tag combination.
  if (tags.natural === 'water') return 'lake'
  return null
}

/**
 * Rough planar area of a GeoJSON polygon, in m².
 *
 * Shoelace on an equirectangular projection about the polygon's own mean
 * latitude. Good to a fraction of a percent at city scale, which is far more
 * precision than "is this bigger than a swimming pool" needs.
 */
function areaSqM(geometry) {
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  let total = 0
  for (const rings of polys) {
    // Outer ring positive, holes negative — index 0 is the outer ring.
    for (const [i, ring] of rings.entries()) {
      if (ring.length < 4) continue
      const meanLat = ring.reduce((s, p) => s + p[1], 0) / ring.length
      const mPerLng = DEG_LAT_M * Math.cos((meanLat * Math.PI) / 180)
      let shoelace = 0
      for (let j = 0; j < ring.length - 1; j++) {
        const [x1, y1] = ring[j]
        const [x2, y2] = ring[j + 1]
        shoelace += (x1 * mPerLng) * (y2 * DEG_LAT_M) - (x2 * mPerLng) * (y1 * DEG_LAT_M)
      }
      total += (i === 0 ? 1 : -1) * Math.abs(shoelace / 2)
    }
  }
  return Math.round(Math.max(total, 0))
}

/** Way (closed line) or relation (multipolygon) → a WaterBody row, or null. */
function elementToRow(el, fetchedCity) {
  const tags = el.tags ?? {}
  const kind = kindOf(tags)
  if (!kind) return null

  let segments
  if (el.type === 'way') {
    if (!Array.isArray(el.geometry)) return null
    segments = [el.geometry.map((p) => [p.lon, p.lat])]
  } else {
    // Outer members only; inner rings are recovered by containment in
    // ringsToGeometry, which is more reliable than OSM's roles here — the same
    // call fetch-osm-boundaries.mjs makes, for the same reason.
    segments = (el.members ?? [])
      .filter((m) => m.type === 'way' && m.role !== 'inner' && Array.isArray(m.geometry))
      .map((m) => m.geometry.map((p) => [p.lon, p.lat]))
  }
  if (!segments.length) return null

  const { rings, dropped } = assembleRings(segments)
  if (!rings.length) return null

  const geometry = ringsToGeometry(rings)
  const bbox = bboxOf(geometry)
  if (!geometry || !bbox) return null

  const area = areaSqM(geometry)
  // Drop puddles at ingest as well as at read: a fountain or a swimming pool
  // tagged natural=water must never become "your nearest lake".
  if (area < MIN_AREA_SQM) return null

  // City from the polygon's centre, not the city being fetched — the fetch bbox
  // is a square around a circular radius, so its corners hold features
  // belonging somewhere else entirely.
  const centreLat = (bbox.minLat + bbox.maxLat) / 2
  const centreLng = (bbox.minLng + bbox.maxLng) / 2
  const city = resolveCity(centreLat, centreLng)?.city ?? null
  if (city !== fetchedCity) return null

  return {
    row: {
      osmId: `${el.type}/${el.id}`,
      // Unnamed is normal and kept: a large share of Indian tanks are mapped
      // with geometry and no name. They still count for distance.
      name: tags['name:en'] ?? tags.name ?? null,
      kind,
      city,
      geometry,
      areaSqM: area,
      ...bbox,
    },
    dropped,
  }
}

async function fetchTile(city, tile, seen) {
  const box = `${tile.south},${tile.west},${tile.north},${tile.east}`
  // `out geom;` NOT `out geom tags;` — in Overpass QL `tags` is a print MODE
  // that replaces `body`, and a relation's shape lives in its members, which
  // are part of body. The boundaries seeder learned this the expensive way:
  // `geom tags` returns every relation with zero members and parses cleanly to
  // zero rows, which looks exactly like "OSM has nothing here".
  const body = SELECTORS.map((sel) => `${sel}(${box});`).join('\n')
  const query = `[out:json][timeout:230];\n(\n${body}\n);\nout geom;`

  const data = await overpass(query)
  let matched = 0
  let droppedRings = 0

  for (const el of data.elements ?? []) {
    if (el.type !== 'way' && el.type !== 'relation') continue
    const result = elementToRow(el, city)
    if (!result) continue
    seen.set(result.row.osmId, result.row)
    droppedRings += result.dropped
    matched++
  }

  return { matched, droppedRings }
}

async function writeRows(rows) {
  // Not wrapped in a transaction: Prisma's 5s transaction cap makes remote
  // seeding fail outright, and every upsert is independent and keyed on osmId.
  const ingestedAt = new Date()
  for (const row of rows) {
    await prisma.waterBody.upsert({
      where: { osmId: row.osmId },
      create: { ...row, ingestedAt },
      update: { ...row, ingestedAt },
    })
  }
}

async function fetchCity(city) {
  const bbox = bboxFor(CITY_CENTERS[city])
  const grid = tiles(bbox, TILE_GRID)
  const seen = new Map()
  const runStart = new Date()
  const failedTiles = []
  let droppedRings = 0

  console.log(`
${city} — ${grid.length} tiles`)

  for (const [i, tile] of grid.entries()) {
    try {
      const { matched, droppedRings: d } = await fetchTile(city, tile, seen)
      droppedRings += d
      process.stdout.write(`  tile ${i + 1}/${grid.length}: ${matched} bodies`)
    } catch (err) {
      failedTiles.push(tile)
      console.warn(`
  tile ${i + 1}/${grid.length}: FAILED — ${err.message}`)
    }
    if (i < grid.length - 1) await sleep(DELAY_BETWEEN_TILES_MS)
  }
  console.log()

  // One retry pass. Overpass mirrors fail transiently far more often than
  // persistently, and a silently-missing tile would make a lakeside address
  // look landlocked.
  let failed = 0
  if (failedTiles.length) {
    console.log(`  retrying ${failedTiles.length} tile(s)…`)
    for (const tile of failedTiles) {
      await sleep(DELAY_BETWEEN_TILES_MS)
      try {
        await fetchTile(city, tile, seen)
      } catch (err) {
        failed++
        console.warn(`  retry FAILED — ${err.message}`)
      }
    }
  }

  const rows = [...seen.values()]
  const byKind = {}
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
  const named = rows.filter((r) => r.name).length

  console.log(`  → ${rows.length} water bodies${failed ? `, ${failed} tile(s) failed` : ''}`)
  for (const [kind, n] of Object.entries(byKind)) console.log(`      ${kind}: ${n}`)
  console.log(`      named: ${named} / ${rows.length}`)
  if (droppedRings) {
    console.log(`      ⚠ ${droppedRings} ring(s) dropped — unclosed geometry in OSM`)
  }
  if (!rows.length) {
    console.log('      ⚠ no water found — terrain and environment will say so rather than guess')
  }

  if (CONFIRM && rows.length) {
    await writeRows(rows)

    if (failed === 0) {
      const { count } = await prisma.waterBody.deleteMany({
        where: { city, ingestedAt: { lt: runStart } },
      })
      if (count) console.log(`  removed ${count} stale water body(ies) no longer in OSM`)
    } else {
      console.log('  skipping stale-row removal — coverage incomplete, re-run to converge')
    }

    // Both consuming modules cache per cell, so without this the new data would
    // not reach a single property page for up to 90 days. Staleness lives at
    // two levels and this helper clears both — see .claude/spatial.md.
    const invalidated = await invalidateCityCells(city, runStart)
    console.log(`  marked ${invalidated} spatial cell(s) stale — the refresher will recompute them`)

    await recordQualityReport({
      dataset: 'water',
      scope: city,
      recordCount: rows.length,
      // An unnamed body is still fully usable for distance, so completeness
      // here reports geometry, not names. Names are reported separately in
      // notes so a low share is visible without being scored as incomplete.
      completenessPct: completeness(rows, ['geometry']),
      complete: failed === 0,
      notes: { byKind, named, total: rows.length, failedTiles: failed, tiles: grid.length, droppedRings },
    })
  }

  return { city, count: rows.length, failed }
}

async function main() {
  const cities = ONLY_CITY ? [ONLY_CITY] : Object.keys(CITY_CENTERS)

  console.log(CONFIRM
    ? `WRITING water bodies for: ${cities.join(', ')}`
    : `DRY RUN (no writes) for: ${cities.join(', ')} — pass --confirm to write`)

  const results = []
  for (const city of cities) results.push(await fetchCity(city))

  console.log('\n─── summary ───')
  for (const r of results) {
    console.log(`  ${r.city.padEnd(12)} ${String(r.count).padStart(5)} bodies${r.failed ? '  ⚠ incomplete' : ''}`)
  }
  if (!CONFIRM) console.log('\nNothing was written. Re-run with --confirm.')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
