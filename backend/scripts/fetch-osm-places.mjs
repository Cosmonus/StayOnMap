// OSM place nodes → Locality rows. The names people actually search with.
//
//   node scripts/fetch-osm-places.mjs                    # dry run (default)
//   node scripts/fetch-osm-places.mjs --confirm          # write
//   node scripts/fetch-osm-places.mjs --city Chennai     # one city
//
// WHY THIS EXISTS. Until 2026-08-08 a locality was resolved from OSM ADMIN
// boundaries — `boundary=administrative`, admin_level 10/9/8. That is the right
// source for civic data and the wrong one for a URL, because Indian wards are
// mostly NUMBERED. The backfill produced exactly this:
//
//     /rent/chennai/ward-137      /rent/mumbai/h-w-ward
//     /rent/chennai/ward-105      /rent/bengaluru/ward-58
//
// Nobody searches "rent in Ward 137". The names a renter types — Velachery,
// Adyar, Mylapore, Nungambakkam, Kodambakkam — live in a different OSM feature
// entirely: `place=suburb | neighbourhood | quarter`. Nothing here fetched them.
//
// NO MIGRATION. `Locality.source` is a String and the table already carries
// `lat`/`lng`/`osmId`, so a place node IS a Locality row with source 'PLACE'.
// The resolution order in features/localities/resolve.js becomes
// PLACE → BOUNDARY → LANDMARK, so a ward number survives only where no
// neighbourhood is mapped, and stays non-indexable when it does.
//
// POINTS, NOT POLYGONS, and that is the honest limitation. A place node is the
// CENTRE of a neighbourhood with no boundary attached, so membership is
// "nearest centre within a radius" rather than point-in-polygon. It is an
// approximation. It is also the approximation every consumer map uses, and it
// is dramatically better than a correct answer nobody searches for.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { recordQualityReport, completeness } from '../src/features/spatial/dataQuality.js'
import { CITY_CENTERS } from '../src/config/cityCenters.js'
import { parseSeedArgs } from '../src/features/spatial/seedArgs.js'
import { bboxFor } from '../src/features/spatial/tiling.js'
import { overpassQuery } from '../src/features/spatial/overpassClient.js'
import { slugify } from '../src/features/localities/resolve.js'

const REQUEST_TIMEOUT_MS = 120_000
const DELAY_BETWEEN_CITIES_MS = 3_000

// Most specific first, and the order is the tie-break when one point sits near
// two of them. `suburb` is the unit a Chennai renter names ("Velachery");
// `neighbourhood` is finer ("CIT Colony"); `quarter` is rare in India but real.
// `city`/`town`/`village` are deliberately EXCLUDED — resolving a listing to
// "Chennai" would produce a locality page identical in scope to the city page,
// which is the duplicate that admin_level 8 already produced once.
const PLACE_TYPES = ['suburb', 'neighbourhood', 'quarter']

const { confirm: CONFIRM, city: ONLY_CITY } = parseSeedArgs(process.argv.slice(2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const overpass = (query) => overpassQuery(query, { timeoutMs: REQUEST_TIMEOUT_MS })

/**
 * Both nodes and areas. A suburb is usually a node in India, but the larger
 * ones are sometimes mapped as a way or relation with `place=` on it — `out
 * center` gives those a coordinate, so both shapes land in the same row form.
 */
async function fetchCity(city) {
  // `bboxFor` returns south/west/north/east — NOT minLat/minLng/maxLat/maxLng,
  // which is what this read on 2026-08-08 and is why every city failed. The
  // four `undefined`s went out inside the query, so Overpass saw
  // `(undefined,undefined,undefined,undefined)`: one mirror answered 400 and
  // the others hung until timeout, which read convincingly as the datacenter
  // being blocked. `fetch-osm-boundaries.mjs` had it right all along.
  const b = bboxFor(CITY_CENTERS[city])
  const box = `${b.south},${b.west},${b.north},${b.east}`
  const filter = `"place"~"^(${PLACE_TYPES.join('|')})$"`

  const query = `[out:json][timeout:110];(`
    + `node[${filter}](${box});`
    + `way[${filter}](${box});`
    + `relation[${filter}](${box});`
    + `);out center tags;`

  const data = await overpass(query)
  const rows = []
  const seen = new Set()

  // Suburbs first, so that when two places share a slug the dedupe below keeps
  // the LARGER one. Overpass returns elements in its own order, so without this
  // the winner is whichever the server happened to emit first.
  const ordered = [...(data.elements ?? [])].sort(
    (a, b) => PLACE_TYPES.indexOf(a.tags?.place) - PLACE_TYPES.indexOf(b.tags?.place),
  )

  for (const el of ordered) {
    // `name:en` first for the same reason the metro engine prefers it — a
    // Tamil-script name is correct and unusable as a URL slug.
    const name = (el.tags?.['name:en'] ?? el.tags?.name ?? '').trim()
    if (!name) continue

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    const slug = slugify(name)
    if (!slug) continue

    // A neighbourhood named after its city is the duplicate-of-the-city-page
    // bug in a different costume. Drop it at the source.
    if (slug === slugify(city)) continue

    // OSM maps some places twice (a node inside its own area). Keep the first,
    // which the type order above has already made the most specific.
    const key = `${slug}`
    if (seen.has(key)) continue
    seen.add(key)

    // Not a neighbourhood, whatever OSM says. Chennai's data contains a bulk
    // import of "CMWSSB Division 105" — Chennai Metropolitan Water Supply and
    // Sewerage Board zones — tagged `place=neighbourhood`, and because
    // resolution takes the NEAREST node they beat Alwarpet and Teynampet.
    //
    // The rule is narrow on purpose: a numbered DIVISION, WARD or ZONE is an
    // administrative artifact nobody searches. `Sector 14` is deliberately NOT
    // in it — in Delhi NCR a sector number is how people actually give their
    // address ("flats in Sector 62"), which is the opposite case.
    if (/\b(division|ward|zone)\s*\d+/i.test(name)) continue

    rows.push({
      osmId: `${el.type}/${el.id}`,
      name,
      slug,
      city,
      citySlug: slugify(city),
      // Two tiers, so resolution can prefer the bigger, better-known area over
      // whichever tiny colony happens to be closest. `source` is a String, so
      // this needs no migration — and isIndexable() accepts both, because
      // "Powai" is a neighbourhood and is exactly what we want.
      source: el.tags.place === 'suburb' ? 'PLACE' : 'PLACE_LOCAL',
      lat,
      lng,
      placeType: el.tags.place,
    })
  }

  return rows
}

/**
 * Upsert by osmId — the same key every other seeder uses, so a re-run updates
 * in place instead of duplicating.
 *
 * `(citySlug, slug)` is also unique, and a collision there is REAL: two OSM
 * places with the same name in one city. Skipped rather than overwritten,
 * because picking a winner arbitrarily would silently move a published URL from
 * one neighbourhood to another.
 */
async function writeRows(rows) {
  let written = 0
  let collided = 0

  for (const r of rows) {
    const { placeType: _placeType, ...data } = r
    try {
      await prisma.locality.upsert({
        where: { osmId: r.osmId },
        // `r.source`, not a literal — hardcoding 'PLACE' here would silently
        // promote every neighbourhood to suburb tier on the second run, which
        // is the kind of bug that only shows up as slightly worse URLs.
        update: { name: r.name, slug: r.slug, lat: r.lat, lng: r.lng, source: r.source },
        create: data,
      })
      written++
    } catch {
      collided++
    }
  }

  return { written, collided }
}

async function main() {
  const cities = ONLY_CITY ? [ONLY_CITY] : Object.keys(CITY_CENTERS)
  console.log(`${CONFIRM ? 'WRITING' : 'DRY RUN'} — ${cities.length} city/cities\n`)

  let total = 0
  let failures = 0

  for (const city of cities) {
    if (!CITY_CENTERS[city]) {
      console.log(`  ${city.padEnd(12)} unknown city — skipped`)
      failures++
      continue
    }

    let rows = []
    try {
      rows = await fetchCity(city)
    } catch (err) {
      console.log(`  ${city.padEnd(12)} FETCH FAILED — ${err.message.slice(0, 60)}`)
      failures++
      await sleep(DELAY_BETWEEN_CITIES_MS)
      continue
    }

    total += rows.length
    const sample = rows.slice(0, 6).map((r) => r.name).join(', ')
    console.log(`  ${city.padEnd(12)} ${String(rows.length).padStart(4)} places   ${sample}${rows.length > 6 ? ' …' : ''}`)

    if (CONFIRM && rows.length) {
      const { written, collided } = await writeRows(rows)
      console.log(`  ${''.padEnd(12)} ${written} written${collided ? `, ${collided} name collisions skipped` : ''}`)
    }

    await sleep(DELAY_BETWEEN_CITIES_MS)
  }

  console.log(`\n${total} place(s) across ${cities.length - failures} city/cities.`)

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm.')
    console.log('Then: node scripts/backfill-localities.mjs --confirm  (re-resolves listings)')
    await prisma.$disconnect()
    return
  }

  // The ETL's own receipt. `complete: false` is what separates "this city is
  // sparse in OSM" from "the fetch failed", which are different problems with
  // different fixes and look identical in a row count.
  await recordQualityReport({
    dataset: 'places',
    scope: ONLY_CITY ?? null,
    recordCount: total,
    completenessPct: completeness(cities.length - failures, cities.length),
    complete: failures === 0,
    notes: { cities: cities.length, failures, placeTypes: PLACE_TYPES },
  })

  console.log('\nNEXT: node scripts/backfill-localities.mjs --confirm')
  console.log('      — listings re-resolve to PLACE now that the rows exist.')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
