// Seed RoadSegment — motorable roads, as lines.
//
// Closes `road_access` for landContext, the weakest module in the layer (0.19
// against a ceiling of 0.50). See docs/spatial-research-2026-07-28.md Track B.
//
// Usage:
//   node scripts/fetch-osm-roads.mjs                    # DRY RUN, writes nothing
//   node scripts/fetch-osm-roads.mjs --confirm          # actually write
//   node scripts/fetch-osm-roads.mjs --city Surat       # one city
//
// ⚠ This is the heaviest seeder in the layer, and unlike the others it is
// TILED. A city bbox holds tens of thousands of road ways; asking Overpass for
// all of them in one query is the reliable way to get a timeout and a
// `complete: false` receipt. `tiling.js` splits the bbox into an n×n grid and
// each tile is fetched separately, so a single failing tile costs one tile
// rather than the city.
//
// The audit's Phase 2 (docs/spatial-platform-audit-2026-07-20.md §4.2) wants
// bulk ingestion to move off Overpass and onto the Geofabrik extract. That is
// the right long-term answer for this dataset in particular — until then, the
// tiling below is what makes Overpass survivable, and the DataQualityReport is
// what makes a partial run visible rather than silent.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'
import { parseSeedArgs, flagValue } from '../src/features/spatial/seedArgs.js'
import { bboxFor, tiles, fetchTileAdaptive } from '../src/features/spatial/tiling.js'
import { overpassQuery } from '../src/features/spatial/overpassClient.js'
import { ALL_MOTORABLE } from '../src/features/spatial/roadLookup.js'

const REQUEST_TIMEOUT_MS = 240_000
const DELAY_BETWEEN_TILES_MS = 2_000
// 4×4 = 16 tiles per city. Chosen so a tile over dense Bengaluru returns a
// response Overpass will actually finish, not so the grid is pretty.
const TILE_GRID = 4

const argv = process.argv.slice(2)
const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(argv)
// Override the starting grid, e.g. `--city Delhi --tiles 6`. Failed tiles now
// subdivide themselves, so this is a coarse dial for a city that is slow
// throughout, not the fix for one stubborn tile.
const gridArg = Number(flagValue(argv, '--tiles'))
const GRID = Number.isFinite(gridArg) && gridArg > 0 ? gridArg : TILE_GRID

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const overpass = (query) => overpassQuery(query, { timeoutMs: REQUEST_TIMEOUT_MS })

// OSM records surface on a long tail of values. These are the ones that mean
// "sealed". Anything else — including nothing at all — leaves `paved` null,
// which the module renders as silence rather than as "unpaved".
const PAVED_SURFACES = new Set([
  'paved', 'asphalt', 'concrete', 'concrete:plates', 'concrete:lanes',
  'paving_stones', 'sett', 'cobblestone', 'chipseal',
])
const UNPAVED_SURFACES = new Set([
  'unpaved', 'gravel', 'fine_gravel', 'dirt', 'earth', 'ground', 'sand', 'mud', 'grass',
])

function pavedFrom(tags) {
  const s = tags.surface
  if (!s) return null
  if (PAVED_SURFACES.has(s)) return true
  if (UNPAVED_SURFACES.has(s)) return false
  return null
}

// `width` is metres by convention but is written "12", "12 m" and occasionally
// in feet. Parse the leading number and reject anything absurd rather than
// storing a value that would render as a confident lie on a plot page.
function widthFrom(tags) {
  const raw = tags.width ?? tags['est_width']
  if (!raw) return null
  const n = Number.parseFloat(String(raw))
  if (!Number.isFinite(n) || n <= 0 || n > 60) return null
  return Math.round(n * 10) / 10
}

function wayToRow(el, fetchedCity) {
  const tags = el.tags ?? {}
  const highway = tags.highway
  if (!ALL_MOTORABLE.includes(highway)) return null
  if (!Array.isArray(el.geometry) || el.geometry.length < 2) return null

  const coordinates = el.geometry.map((p) => [p.lon, p.lat])
  const lats = coordinates.map((c) => c[1])
  const lngs = coordinates.map((c) => c[0])
  const bbox = {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
  }

  // City from the way's midpoint, not the city being fetched — the fetch bbox
  // is a square around a circular radius, so its corners hold roads belonging
  // somewhere else. Same correction the POI and boundary seeders make.
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const midLng = (bbox.minLng + bbox.maxLng) / 2
  const city = resolveCity(midLat, midLng)?.city ?? null
  if (city !== fetchedCity) return null

  return {
    osmId: `way/${el.id}`,
    name: tags['name:en'] ?? tags.name ?? null,
    highway,
    widthM: widthFrom(tags),
    paved: pavedFrom(tags),
    city,
    geometry: { type: 'LineString', coordinates },
    ...bbox,
  }
}

async function fetchTile(city, tile, seen) {
  const box = `${tile.south},${tile.west},${tile.north},${tile.east}`
  // A single regex selector rather than one clause per class: Overpass compiles
  // it once, and the class filter is re-applied in wayToRow anyway.
  const classes = ALL_MOTORABLE.join('|')
  // `out geom;` — ways carry their shape in `geometry` under body mode. The
  // `tags` print mode would drop it, which is the trap the boundaries seeder
  // documented the hard way.
  const query = `[out:json][timeout:230];\n` +
    `way["highway"~"^(${classes})$"](${box});\n` +
    `out geom;`

  const data = await overpass(query)
  let matched = 0
  for (const el of data.elements ?? []) {
    if (el.type !== 'way') continue
    const row = wayToRow(el, city)
    if (!row) continue
    // Tiles overlap at their edges and a way can span two, so dedupe by osmId.
    seen.set(row.osmId, row)
    matched++
  }
  return matched
}

async function writeRows(rows) {
  // Not a transaction: Prisma's 5s cap makes remote seeding of this volume fail
  // outright, and every upsert is independent and keyed on osmId.
  const ingestedAt = new Date()
  let written = 0
  for (const row of rows) {
    await prisma.roadSegment.upsert({
      where: { osmId: row.osmId },
      create: { ...row, ingestedAt },
      update: { ...row, ingestedAt },
    })
    written++
    if (written % 5000 === 0) console.log(`    …${written}/${rows.length} written`)
  }
}

async function fetchCity(city) {
  const bbox = bboxFor(CITY_CENTERS[city])
  const grid = tiles(bbox, GRID)
  const seen = new Map()
  const runStart = new Date()
  let failed = 0

  console.log(`
${city} — ${grid.length} tiles`)

  for (const [i, tile] of grid.entries()) {
    try {
      // Roads are the heaviest dataset here, so this matters more than it does
      // for water: a 504 says the box held too much, and quartering it is the
      // only retry that changes that.
      const matched = await fetchTileAdaptive(
        tile,
        (t) => fetchTile(city, t, seen),
        {
          delayMs: DELAY_BETWEEN_TILES_MS,
          onSplit: (depth) => console.log(
            `
  tile ${i + 1}/${grid.length}: too large, splitting into 4 (depth ${depth + 1})`
          ),
        }
      )
      process.stdout.write(`  tile ${i + 1}/${grid.length}: ${matched} ways`)
    } catch (err) {
      failed++
      console.warn(`
  tile ${i + 1}/${grid.length}: FAILED after subdividing — ${err.message}`)
    }
    if (i < grid.length - 1) await sleep(DELAY_BETWEEN_TILES_MS)
  }
  console.log()

  const rows = [...seen.values()]
  const byClass = {}
  for (const r of rows) byClass[r.highway] = (byClass[r.highway] ?? 0) + 1
  const withWidth = rows.filter((r) => r.widthM != null).length

  console.log(`  → ${rows.length} road ways${failed ? `, ${failed} tile(s) failed` : ''}`)
  for (const [k, n] of Object.entries(byClass).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`      ${k}: ${n}`)
  }
  console.log(`      with a recorded width: ${withWidth} / ${rows.length}`)
  if (failed) {
    console.log('      ⚠ incomplete — a missing tile reads as "no road access" to a plot buyer')
  }

  if (CONFIRM && rows.length) {
    await writeRows(rows)

    if (failed === 0) {
      const { count } = await prisma.roadSegment.deleteMany({
        where: { city, ingestedAt: { lt: runStart } },
      })
      if (count) console.log(`  removed ${count} stale road(s) no longer in OSM`)
    } else {
      console.log('  skipping stale-row removal — coverage incomplete, re-run to converge')
    }

    // Without this the new data reaches no property page until the cells expire
    // on their own — up to 24 days for landContext. Staleness lives at two
    // levels and this clears both (.claude/spatial.md).
    const invalidated = await invalidateCityCells(city, runStart)
    console.log(`  marked ${invalidated} spatial cell(s) stale — the refresher will recompute them`)

    await recordQualityReport({
      dataset: 'roads',
      scope: city,
      recordCount: rows.length,
      // Geometry is what makes a road usable here; names are optional and an
      // unnamed residential street still proves access.
      completenessPct: completeness(rows, ['geometry']),
      complete: failed === 0,
      notes: { byClass, withWidth, total: rows.length, failedTiles: failed, tiles: grid.length, grid: GRID },
    })
  }

  return { city, count: rows.length, failed }
}

async function main() {
  const cities = ONLY_CITY ? [ONLY_CITY] : Object.keys(CITY_CENTERS)

  console.log(CONFIRM
    ? `WRITING roads for: ${cities.join(', ')}`
    : `DRY RUN (no writes) for: ${cities.join(', ')} — pass --confirm to write`)

  const results = []
  for (const city of cities) results.push(await fetchCity(city))

  console.log('\n─── summary ───')
  for (const r of results) {
    console.log(`  ${r.city.padEnd(12)} ${String(r.count).padStart(7)} ways${r.failed ? '  ⚠ incomplete' : ''}`)
  }
  if (!CONFIRM) console.log('\nNothing was written. Re-run with --confirm.')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
