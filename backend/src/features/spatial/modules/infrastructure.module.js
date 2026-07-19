// Infrastructure — "can I do errands without a 40-minute round trip, and will
// my internet work?"
//
// Internet is the headline question and the one this module currently cannot
// answer. See INTERNET below — the omission is deliberate and explained to the
// user rather than filled with a guess.
//
// Everything else comes from the self-hosted OSM POI table. Unlike lifestyle,
// there is no Google fallback here: these categories (EV charging, government
// offices) are ones where Google's Indian coverage is no better than OSM's,
// and paying per call for a worse answer is not a trade worth making.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, cityCategoryCoverage, OSM_POI_SOURCE } from '../poiProvider.js'
import { RESIDENTIAL_TYPES } from '../propertyTypes.js'
import { walkDisplay, formatDistance } from '../proximity.js'

const RADIUS = 2000

// `sinceVocabularyV2: true` marks categories added after the first seed.
// For those, a zero city-wide count means "seeded before this category
// existed", and the module must say "not loaded yet" rather than "none
// nearby" — see cityCategoryCoverage() in poiProvider.js.
const CATEGORIES = [
  { key: 'bank',         label: 'Banks',               weight: 2 },
  { key: 'atm',          label: 'ATMs',                weight: 2 },
  { key: 'fuel',         label: 'Fuel stations',       weight: 1 },
  { key: 'government',   label: 'Government services', weight: 1 },
  { key: 'ev_charging',  label: 'EV charging',         weight: 1 },
  { key: 'police',       label: 'Police',              weight: 1, sinceVocabularyV2: true },
  { key: 'fire_station', label: 'Fire station',        weight: 1, sinceVocabularyV2: true },
]

export default {
  key: 'infrastructure',
  // v4: internet_speed re-weighted (see inputs). The bump is load-bearing, not
  // cosmetic — ttlHours below is 30 days, so without it every already-computed
  // cell would keep reporting the old confidence for a month
  // (registry.js recomputes a module only when its version !== the stored one).
  //
  // 4 and not 3: envelopes stamped v3 are already in SpatialContext from an
  // earlier dev run, even though the source read v2 when this change was made.
  // Reusing 3 would have compared equal to those rows and skipped exactly the
  // recompute this bump exists to force. Version numbers here are cache keys,
  // so the only safe move is forward past anything already written.
  //
  // v5: walk-time phrasing, counts as data, police + fire station categories
  // (coverage-gated), civic-safety input declared.
  version: 5,
  // Banking and fuel matter to a resident and to a shopkeeper. A bare plot is
  // served by landContext instead, which asks about road access rather than ATMs.
  appliesTo: [...RESIDENTIAL_TYPES, 'PG', 'COMMERCIAL', 'SHORT_STAY'],
  ttlHours: 24 * 30, // a bank branch is not a weekly-changing fact
  maxConfidence: 0.75,

  inputs: [
    { key: 'poi_banking',    weight: 2 },
    { key: 'poi_utilities',  weight: 2 }, // fuel, EV, government
    // INTERNET: no free per-location broadband dataset exists for India today.
    // The one real option is Ookla's open data (z16 tiles, ~610m, quarterly
    // Parquet on AWS Open Data) — genuine crowd-sourced measurements with no
    // commercial equivalent worth buying. It needs an offline ingestion step
    // and a Parquet reader, so it is scoped as its own piece of work rather
    // than half-done here. Declared as an input so its absence visibly holds
    // this module's confidence down instead of quietly not mattering.
    // See docs/spatial-intelligence.md §5.3.
    //
    // Weight 1, not 3. At 3 of 7 total this module could never clear 0.43 —
    // below the 0.50 MODERATE threshold — so a location with every bank, ATM,
    // fuel station and government office actually MEASURED still reported "Low
    // confidence". A permanently-absent input should visibly cost the module
    // something, which is why it stays declared; it should not cap a module of
    // measured facts under a band that reads as "don't rely on this". At 1 of 5
    // the honest ceiling is 0.60 — Moderate, with the gap still declared and
    // still named in `missing`.
    { key: 'internet_speed', weight: 1 },
    // Present once the city's seed includes police/fire data. Absent on a
    // pre-vocabulary-v2 seed, which correctly holds confidence down until the
    // operator re-runs scripts/fetch-osm-pois.mjs.
    { key: 'poi_civic_safety', weight: 1 },
  ],

  async compute({ lat, lng, city }) {
    const [result, coverage] = await Promise.all([
      poisNear(lat, lng, RADIUS, CATEGORIES.map((c) => c.key), city),
      cityCategoryCoverage(city),
    ])

    if (!result.available) {
      return {
        facts: [],
        assessment: null,
        missing: [
          'Local infrastructure data has not been loaded for this city yet.',
          INTERNET_NOTE,
        ],
        inputsPresent: [],
        sources: [],
      }
    }

    // A newer category with zero rows city-wide was never seeded here — every
    // Indian city has police stations, so "none mapped within 2 km" would be
    // the map talking, not the street. Drop those categories and say why once.
    const unseeded = CATEGORIES.filter((c) => c.sinceVocabularyV2 && !coverage[c.key])
    const live = CATEGORIES.filter((c) => !unseeded.includes(c))

    const found = live.map((c) => {
      const hits = result.byCategory[c.key] ?? []
      return { ...c, count: hits.length, nearestM: hits[0]?.distanceM ?? null }
    })

    const facts = found.map((c) => fact({
      key: `nearest_${c.key}`,
      label: c.label,
      value: c.nearestM,
      unit: 'm',
      display: c.nearestM === null
        ? `none mapped within ${formatDistance(RADIUS)}`
        : `${walkDisplay(c.nearestM)} · ${c.count} within ${formatDistance(RADIUS)}`,
      provenance: PROVENANCE.MEASURED,
      source: 'osm-poi',
      count: c.count,
    }))

    const inputsPresent = []
    if (found.some((c) => ['bank', 'atm'].includes(c.key) && c.count > 0)) inputsPresent.push('poi_banking')
    if (found.some((c) => ['fuel', 'government', 'ev_charging'].includes(c.key) && c.count > 0)) inputsPresent.push('poi_utilities')
    if (found.some((c) => ['police', 'fire_station'].includes(c.key) && c.count > 0)) inputsPresent.push('poi_civic_safety')

    const missing = [INTERNET_NOTE]

    if (unseeded.length) {
      missing.push(
        `${unseeded.map((c) => c.label).join(' and ')} locations haven't been ` +
        'loaded for this city yet — the local dataset predates them.'
      )
    }

    // EV charging is the category where OSM's Indian coverage is weakest, and
    // a bare "0 nearby" would read as "there are none" rather than "none are
    // mapped". Those are different claims and only one of them is supportable.
    if (!found.find((c) => c.key === 'ev_charging')?.count) {
      missing.push(
        'OpenStreetMap coverage of EV charging points in India is partial — ' +
        'none mapped nearby does not mean none exist.'
      )
    }

    if (result.sparselyMapped) {
      missing.push(
        `Only ${result.total} mapped facilities within ${formatDistance(RADIUS)} — this area looks ` +
        'lightly mapped, so this is likely an undercount.'
      )
    }

    return {
      facts,
      assessment: assess(found),
      missing,
      inputsPresent,
      sources: [OSM_POI_SOURCE],
      sparselyMapped: result.sparselyMapped,
    }
  },
}

const INTERNET_NOTE =
  'Broadband speed at this address is not available — no free per-location ' +
  'internet performance data covers India, and we would rather say so than ' +
  'quote a city-wide average as if it were your street.'

function assess(found) {
  const banking = found.find((c) => c.key === 'bank')
  const atm = found.find((c) => c.key === 'atm')
  const nearestBanking = [banking?.nearestM, atm?.nearestM].filter((n) => n != null)
  const closest = nearestBanking.length ? Math.min(...nearestBanking) : null

  const label =
    closest === null ? 'Little infrastructure mapped nearby' :
    closest <= 500 ? 'Banking and essentials on the doorstep' :
    closest <= 1200 ? 'Banking within a short walk' :
    'Banking and essentials need a short ride'

  const present = found.filter((c) => c.count > 0).map((c) => c.label.toLowerCase())
  const detail = present.length
    ? `Mapped nearby: ${present.join(', ')}.`
    : 'Nothing in these categories is mapped within 2 km.'

  return { label, detail }
}
