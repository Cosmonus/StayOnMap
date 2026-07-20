#!/usr/bin/env node
// Seed Boundary from OpenStreetMap via the Overpass API.
//
// Sibling of fetch-osm-pois.mjs, and deliberately the same shape: dry-run by
// default, endpoint rotation, upsert on osmId, ghost removal only after a
// fully-successful fetch, cell invalidation afterwards, quality report at the
// end. Differences from that script are noted where they occur.
//
// A developer-machine operation, not a runtime one. See docs/operator-actions.md.
//
//   node scripts/fetch-osm-boundaries.mjs                    # dry run, all cities
//   node scripts/fetch-osm-boundaries.mjs --city Chennai     # dry run, one city
//   node scripts/fetch-osm-boundaries.mjs --confirm          # actually write
//
// Re-runnable: rows are keyed on osmId, so a second run updates in place.
// Municipal boundaries change rarely — yearly is more than enough.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { assembleRings, ringsToGeometry, bboxOf } from '../src/features/spatial/boundaryGeometry.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { bboxFor } from '../src/features/spatial/tiling.js'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const REQUEST_TIMEOUT_MS = 240_000
const DELAY_BETWEEN_LEVELS_MS = 3_000

// 6=district, 8=municipality, 9=zone, 10=ward. Levels 4-5 (state, division) are
// deliberately excluded: they are identical for every listing in a city, so
// they add a row per boundary and nothing a user could act on.
//
// NOT tiled like the POI seeder. A city has tens of boundaries where it has
// hundreds of thousands of POIs, so one query per admin level is small — but
// each carries full polygon geometry, hence the longer timeout above.
const ADMIN_LEVELS = [6, 8, 9, 10]

const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(process.argv.slice(2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function overpass(query) {
  let lastError = null
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'StayOnMap/1.0 (spatial intelligence boundary seed; https://www.stayonmap.com)',
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

/**
 * Turn one relation into a row, or null if its geometry can't be trusted.
 *
 * `out geom` gives every member way's full coordinate list, which is what makes
 * assembling rings possible without a second round trip per way.
 */
function relationToRow(el, fetchedCity) {
  const tags = el.tags ?? {}
  const name = tags['name:en'] ?? tags.name
  // A boundary with no name is unusable — it can be shown to nobody and joined
  // to nothing. Dropping it is better than storing an anonymous polygon.
  if (!name) return null

  // Outer members only. Inner rings are recovered by containment in
  // ringsToGeometry, which is more reliable than OSM's roles here — Indian
  // boundary relations frequently omit or mis-tag them.
  const segments = (el.members ?? [])
    .filter((m) => m.type === 'way' && m.role !== 'inner' && Array.isArray(m.geometry))
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]))

  if (!segments.length) return null

  const { rings, dropped } = assembleRings(segments)
  if (!rings.length) return null

  const geometry = ringsToGeometry(rings)
  const bbox = bboxOf(geometry)
  if (!geometry || !bbox) return null

  // City from the polygon's centre, not the city being fetched — the same
  // correction fetch-osm-pois.mjs makes, and for the same reason: the fetch
  // bbox is a square around a circular radius, so its corners hold boundaries
  // belonging to somewhere else entirely.
  const centreLat = (bbox.minLat + bbox.maxLat) / 2
  const centreLng = (bbox.minLng + bbox.maxLng) / 2
  const city = resolveCity(centreLat, centreLng)?.city ?? null
  if (city !== fetchedCity) return null

  return {
    row: {
      osmId: `relation/${el.id}`,
      name,
      // Only store the local name when it genuinely differs from the English
      // one, so the UI doesn't render "Adyar (Adyar)".
      nameLocal: tags.name && tags.name !== name ? tags.name : null,
      adminLevel: Number(tags.admin_level),
      city,
      geometry,
      ...bbox,
    },
    dropped,
  }
}

async function fetchLevel(city, bbox, level, seen) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  // `out geom;`, NOT `out geom tags;`. In Overpass QL, `tags` is a print MODE
  // (ids + tags only) that replaces the default `body` mode — and members are
  // part of body. So `geom tags` returns every relation with its name and
  // admin_level intact and ZERO members, which parses cleanly to zero
  // boundaries and looks exactly like "OSM has nothing here".
  //
  // fetch-osm-pois.mjs's `out center tags;` is correct for what it does: for a
  // node or way, `center` attaches a coordinate that survives tags mode. A
  // relation's shape lives in its members, so it needs body.
  const query = `[out:json][timeout:230];\n` +
    `relation["boundary"="administrative"]["admin_level"="${level}"](${box});\n` +
    `out geom;`

  const data = await overpass(query)
  let matched = 0
  let droppedRings = 0

  for (const el of data.elements ?? []) {
    if (el.type !== 'relation') continue
    const result = relationToRow(el, city)
    if (!result) continue
    seen.set(result.row.osmId, result.row)
    droppedRings += result.dropped
    matched++
  }

  return { matched, droppedRings }
}

async function writeRows(rows) {
  // Not wrapped in a transaction, for the reason fetch-osm-pois.mjs spells
  // out: Prisma's 5s transaction cap makes remote seeding fail outright, and
  // every upsert here is independent and keyed on osmId.
  const ingestedAt = new Date()
  for (const row of rows) {
    await prisma.boundary.upsert({
      where: { osmId: row.osmId },
      create: { ...row, ingestedAt },
      update: { ...row, ingestedAt },
    })
  }
}

async function fetchCity(city) {
  const bbox = bboxFor(CITY_CENTERS[city])
  const seen = new Map()
  const runStart = new Date()
  const failedLevels = []
  let droppedRings = 0

  console.log(`\n${city} — admin levels ${ADMIN_LEVELS.join(', ')}`)

  for (const [i, level] of ADMIN_LEVELS.entries()) {
    try {
      const { matched, droppedRings: d } = await fetchLevel(city, bbox, level, seen)
      droppedRings += d
      console.log(`  level ${level}: ${matched} boundaries`)
    } catch (err) {
      failedLevels.push(level)
      console.warn(`  level ${level}: FAILED — ${err.message}`)
    }
    if (i < ADMIN_LEVELS.length - 1) await sleep(DELAY_BETWEEN_LEVELS_MS)
  }

  // One retry pass, same reasoning as the POI seeder: Overpass mirrors fail
  // transiently far more often than persistently, and a silently-missing ward
  // level is exactly the gap the locality module has to caveat.
  let failed = 0
  if (failedLevels.length) {
    console.log(`  retrying ${failedLevels.length} level(s)…`)
    for (const level of failedLevels) {
      await sleep(DELAY_BETWEEN_LEVELS_MS)
      try {
        const { matched } = await fetchLevel(city, bbox, level, seen)
        console.log(`  retry level ${level}: ${matched} boundaries`)
      } catch (err) {
        failed++
        console.warn(`  retry level ${level} FAILED — ${err.message}`)
      }
    }
  }

  const rows = [...seen.values()]
  const byLevel = {}
  for (const r of rows) byLevel[r.adminLevel] = (byLevel[r.adminLevel] ?? 0) + 1

  console.log(`  → ${rows.length} boundaries${failed ? `, ${failed} level(s) failed` : ''}`)
  for (const level of ADMIN_LEVELS) {
    if (byLevel[level]) console.log(`      level ${level}: ${byLevel[level]}`)
  }
  if (droppedRings) {
    // Worth surfacing rather than swallowing: a dropped ring means a relation
    // whose members did not close, so that boundary's shape is incomplete.
    console.log(`      ⚠ ${droppedRings} ring(s) dropped — unclosed geometry in OSM`)
  }
  if (!byLevel[9] && !byLevel[10]) {
    console.log('      ⚠ no ward/zone boundaries — locality will show municipality only here')
  }

  if (CONFIRM && rows.length) {
    await writeRows(rows)

    if (failed === 0) {
      const { count } = await prisma.boundary.deleteMany({
        where: { city, ingestedAt: { lt: runStart } },
      })
      if (count) console.log(`  removed ${count} stale boundary(ies) no longer in OSM`)
    } else {
      console.log('  skipping stale-row removal — coverage incomplete, re-run to converge')
    }

    const invalidated = await invalidateCityCells(city, runStart)
    console.log(`  marked ${invalidated} spatial cell(s) stale — the refresher will recompute them`)

    await recordQualityReport({
      dataset: 'boundaries',
      scope: city,
      recordCount: rows.length,
      // A boundary is useful when it has a name; unnamed ones are already
      // dropped above, so this reports the share that survived with one.
      completenessPct: completeness(rows, ['name']),
      complete: failed === 0,
      notes: {
        byLevel,
        failedLevels: failed,
        droppedRings,
        hasWardLevel: Boolean(byLevel[9] || byLevel[10]),
      },
    })
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
    ? `Writing Boundary for: ${cities.join(', ')}`
    : `DRY RUN (no writes) for: ${cities.join(', ')} — pass --confirm to write`)

  const results = []
  for (const city of cities) results.push(await fetchCity(city))

  const total = results.reduce((s, r) => s + r.count, 0)
  const failedLevels = results.reduce((s, r) => s + r.failed, 0)
  console.log(`\nTotal: ${total} boundaries across ${results.length} cities`)
  if (failedLevels) console.log(`⚠ ${failedLevels} level(s) failed — coverage is incomplete; re-run to fill the gaps`)
  if (!CONFIRM) console.log('Nothing was written. Re-run with --confirm.')

  await prisma.$disconnect()
  // Explicit exit, not a tidy-up: invalidateCityCells pulls in lib/redis.js,
  // and with REDIS_URL set the open Redis connection keeps the event loop
  // alive forever — the script prints Total, writes its report, and then sits
  // as a zombie (observed: a Delhi run alive 3h after finishing, wedging the
  // shell loop that was iterating cities). Every write above is awaited, so
  // exiting here loses nothing.
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
