// Lifestyle — "is daily life walkable from here, or is everything a drive?"
//
// Two sources, in preference order:
//   1. PoiIndex — self-hosted OpenStreetMap, seeded by scripts/fetch-osm-pois.mjs.
//      Free per query, and it can answer how well-mapped an area is, which
//      Google cannot.
//   2. Google Places Nearby — the Phase 1 path, kept as a fallback so a city
//      that hasn't been seeded yet still says something useful.
//
// The facts and the index are identical either way. Only the sourcing, the
// cost, and the confidence differ.
import { haversineMeters } from '../../../lib/geohash.js'
import { fact, PROVENANCE } from '../envelope.js'
import { nearbyPlaces, GOOGLE_PLACES_SOURCE } from '../providers.js'
import { poisNear, pickNearest, OSM_POI_SOURCE, poiConfidenceFactors } from '../poiProvider.js'
import { RESIDENTIAL_TYPES } from '../propertyTypes.js'
import { walkDisplay, formatDistance } from '../proximity.js'

// Distance bands, in metres. 800m is the widely-used "10-15 minute walk";
// 400m is a genuinely short one; beyond 1600m people drive.
const NEAR = 400
const WALKABLE = 800
const REACHABLE = 1600

// Weights say how much a category matters to *daily* life. Groceries and a
// pharmacy are things you need on a Tuesday night; a gym or a cinema is not.
// This is the opinionated part of the module, so it lives in one table and is
// published to the user rather than buried in a formula.
// `poiKeys` is what gets queried in PoiIndex; `key` stays the stable fact key.
// Healthcare spans two categories since the vocabulary split hospitals from
// clinics — merging here keeps `nearest_hospital` meaning "nearest care",
// which is the question, while the detail list can still show them apart.
const CATEGORIES = [
  // Unions `marketplace`, which was split out of supermarket 2026-07-20 so the
  // two stay distinguishable in a detail list. "Can I buy vegetables walking
  // distance from here" is answered by a mandi as much as by a shop, so the
  // headline weight counts both; `prefer` still headlines the shop, since a
  // daily-open store is the better answer when both are equally close.
  { key: 'supermarket', label: 'Groceries', googleType: 'supermarket', weight: 3, poiKeys: ['supermarket', 'marketplace'], prefer: ['supermarket', 'marketplace'] },
  { key: 'pharmacy',    label: 'Pharmacy',     googleType: 'pharmacy',    weight: 3 },
  // `prefer` breaks a near-tie toward the more substantial facility: asked for
  // "Healthcare", a hospital 450 m away is a better answer than one doctor's
  // room at 430 m. Only applies within pickNearest's 150 m band — a hospital
  // 2 km off never outranks a clinic next door.
  { key: 'hospital',    label: 'Healthcare',   googleType: 'hospital',    weight: 2, poiKeys: ['hospital', 'clinic'], prefer: ['hospital', 'clinic'] },
  { key: 'school',      label: 'Schools',      googleType: 'school',      weight: 2 },
  // fast_food lives in the `food_cheap` category (it used to collide into
  // `restaurant` and starve pgContext — see poiCategories.js); "Restaurants"
  // here means anywhere to eat, so it unions the two, like healthcare does.
  { key: 'restaurant',  label: 'Restaurants',  googleType: 'restaurant',  weight: 2, poiKeys: ['restaurant', 'food_cheap'] },
  // Same idea: a real supermarket beats a corner shop when both are as close.
  { key: 'bank',        label: 'Banks',        googleType: 'bank',        weight: 1 },
  { key: 'park',        label: 'Parks',        googleType: 'park',        weight: 1 },
  { key: 'gym',         label: 'Gyms',         googleType: 'gym',         weight: 1 },
  { key: 'cafe',        label: 'Cafés',        googleType: 'cafe',        weight: 1 },
]

const WALKABILITY_METHOD =
  'each of 9 everyday categories scores 1.0 within 400 m, 0.6 within 800 m, ' +
  '0.25 within 1600 m, else 0 — then weighted toward daily needs ' +
  '(groceries and pharmacy count triple a gym or café)'

function bandScore(distanceM) {
  if (distanceM === null) return 0
  if (distanceM <= NEAR) return 1
  if (distanceM <= WALKABLE) return 0.6
  if (distanceM <= REACHABLE) return 0.25
  return 0
}

/** Self-hosted path: one indexed query answers every category at once. */
async function fromLocalIndex(lat, lng, city) {
  const queried = CATEGORIES.flatMap((c) => c.poiKeys ?? [c.key])
  const result = await poisNear(lat, lng, REACHABLE, queried, city)
  if (!result.available) return null

  return {
    source: 'osm-poi',
    sourceMeta: { ...OSM_POI_SOURCE, fetchedAt: result.fetchedAt },
    sparselyMapped: result.sparselyMapped,
    truncated: result.truncated,
    totalNearby: result.total,
    categories: CATEGORIES.map((c) => {
      const hits = (c.poiKeys ?? [c.key])
        .flatMap((k) => result.byCategory[k] ?? [])
        .sort((a, b) => a.distanceM - b.distanceM)
      // Headline the nearest NAMED place when one is comparably close — a
      // named fact is more useful and more checkable than an anonymous point
      // — and prefer the more substantial facility for merged categories.
      const nearest = pickNearest(hits, { prefer: c.prefer })
      return { ...c, count: hits.length, nearestM: nearest?.distanceM ?? null, nearest }
    }),
  }
}

/** Fallback: one metered Google call per category. */
async function fromGoogle(lat, lng) {
  const results = await Promise.all(
    CATEGORIES.map((c) => nearbyPlaces(lat, lng, { type: c.googleType, radius: REACHABLE }))
  )

  const categories = CATEGORIES.map((c, i) => {
    const places = results[i]
    return {
      ...c,
      // null means the lookup failed — kept distinct from 0, which is a
      // finding. Conflating them turns "we didn't find out" into "there is
      // nothing here".
      count: places === null ? null : places.length,
      nearestM: places === null || places.length === 0
        ? null
        : Math.round(Math.min(...places.map((p) => haversineMeters(lat, lng, p.lat, p.lng)))),
    }
  })

  if (categories.every((c) => c.count === null)) return null

  return {
    source: 'google-places',
    sourceMeta: GOOGLE_PLACES_SOURCE,
    // Google exposes no way to tell a well-mapped area from a thin one.
    sparselyMapped: null,
    totalNearby: null,
    categories,
  }
}

export default {
  key: 'lifestyle',
  // v5: nearest facts carry the target's coordinates (`at`) + name for
  // read-time re-anchoring, restaurants union food_cheap (the fast_food
  // category fix), node/way dedup upstream changes counts, and distance
  // provenance corrected to DERIVED. All of that lives in stored envelopes,
  // so the bump forces existing cells to recompute.
  version: 6, // v6 (2026-07-20): corrected vocabulary — marketplace unioned into groceries, fast_food unshadowed, gardens no longer parks; distances drop the assumed walk time // v4: walk-time phrasing; v3: gated to types where somebody lives
  // Walkability to a pharmacy is a fact about LIVING somewhere. A plot or a
  // warehouse has no residents, so this card is hidden for them rather than
  // shown with a caveat.
  appliesTo: [...RESIDENTIAL_TYPES, 'PG', 'SHORT_STAY'],
  ttlHours: 24 * 14, // shops open and close, but not on a weekly cadence
  maxConfidence: 0.80,

  inputs: [
    { key: 'poi_daily',   weight: 3 }, // groceries, pharmacy — the load-bearing ones
    { key: 'poi_civic',   weight: 2 }, // healthcare, schools
    { key: 'poi_leisure', weight: 1 }, // restaurants, cafés, gyms, parks, banks
    // Only the self-hosted table can answer this. On the Google fallback path
    // it stays absent, which correctly caps that path's confidence lower —
    // Google can tell you what it found, never what nobody mapped.
    { key: 'poi_density_baseline', weight: 2 },
  ],

  async compute({ lat, lng, city }) {
    const data = (await fromLocalIndex(lat, lng, city)) ?? (await fromGoogle(lat, lng))

    if (!data) {
      return {
        facts: [],
        assessment: null,
        missing: ['Nearby places data was unavailable for this location.'],
        inputsPresent: [],
        sources: [],
      }
    }

    const usable = data.categories.filter((c) => c.count !== null)

    const inputsPresent = []
    if (usable.some((c) => ['supermarket', 'pharmacy'].includes(c.key))) inputsPresent.push('poi_daily')
    if (usable.some((c) => ['hospital', 'school'].includes(c.key))) inputsPresent.push('poi_civic')
    if (usable.some((c) => ['restaurant', 'cafe', 'gym', 'park', 'bank'].includes(c.key))) inputsPresent.push('poi_leisure')
    if (data.sparselyMapped !== null) inputsPresent.push('poi_density_baseline')

    const facts = usable.map((c) => fact({
      key: `nearest_${c.key}`,
      label: c.label,
      value: c.nearestM,
      unit: 'm',
      // "Apollo Pharmacy — about a 6 min walk (420 m) · 3 within 1.6 km" —
      // time is what people weigh, distance stays alongside it. The walk
      // conversion's assumptions are disclosed once, in the walkability
      // method below. Same shape reanchor.js rebuilds at read time.
      display: c.nearestM === null
        ? `none within ${formatDistance(REACHABLE)}`
        : `${c.nearest?.name ? `${c.nearest.name} — ` : ''}${walkDisplay(c.nearestM)} · ${c.count} within ${formatDistance(REACHABLE)}`,
      // DERIVED, not MEASURED: the place's coordinates are measured (OSM);
      // the distance is arithmetic between them and a position — exactly the
      // contract's definition of DERIVED. Calling cell-anchored haversine
      // MEASURED was the one breach of the layer's own provenance rules.
      provenance: PROVENANCE.DERIVED,
      source: data.source,
      count: c.count,
      // Target coordinates travel with the fact so the read path can re-derive
      // the distance from the actual property, not the cell centre. OSM path
      // only — Google-sourced coordinates are never persisted (ToS).
      at: c.nearest ? { lat: c.nearest.lat, lng: c.nearest.lng } : undefined,
      place: c.nearest?.name ?? undefined,
      withinM: c.nearestM === null ? undefined : REACHABLE,
    }))

    // ── Walkability index ──────────────────────────────────────────────────
    // Computed only over categories actually looked up, so a failed lookup
    // lowers confidence rather than silently scoring that category zero —
    // which would read as "no pharmacy nearby" when the truth is "we didn't
    // find out".
    const totalWeight = usable.reduce((s, c) => s + c.weight, 0)
    const earned = usable.reduce((s, c) => s + bandScore(c.nearestM) * c.weight, 0)
    const walkability = Math.round((earned / totalWeight) * 100)

    facts.push(fact({
      key: 'walkability',
      label: 'Everyday walkability',
      value: walkability,
      unit: 'index',
      display: `${walkability} / 100`,
      // ESTIMATED, not DERIVED. envelope.js defines DERIVED as "arithmetic over
      // MEASURED inputs, ADDING NO ASSUMPTION" — and this index is nothing but
      // assumptions: that groceries matter three times as much as a gym, that
      // 400 m scores 1.0 and 800 m scores 0.6. Those are defensible opinions,
      // and they are still opinions. A heuristic standing between the data and
      // the claim is exactly what ESTIMATED means.
      //
      // The tell was already here: it carried a `method`, which DERIVED does not
      // require and ESTIMATED does. Someone half-knew.
      provenance: PROVENANCE.ESTIMATED,
      source: 'derived',
      method: WALKABILITY_METHOD,
    }))

    return {
      facts,
      assessment: assess(walkability, usable),
      missing: buildMissing(data),
      inputsPresent,
      sources: [data.sourceMeta],
      sparselyMapped: data.sparselyMapped,
      // `sparselyMapped` says the area looks thin; this says our own fetch of
      // it fell short. A reader cannot tell those apart from the counts alone,
      // and only the second is our fault.
      confidenceFactors: await poiConfidenceFactors(data.source, city),
    }
  },
}

function buildMissing(data) {
  const missing = []

  const failed = data.categories.filter((c) => c.count === null)
  if (failed.length) {
    missing.push(`Couldn't look up ${failed.map((c) => c.label.toLowerCase()).join(', ')} for this location.`)
  }

  if (data.truncated) {
    // The exhaustive scan hit its runaway ceiling — essentially never happens,
    // but if it does the honest reading of every count here is "at least".
    missing.push('This area is so densely mapped that counts are a floor, not a total.')
  }

  if (data.sparselyMapped === true) {
    // The honest headline for a thin area, and the reason the self-hosted
    // table is worth the trouble: this sentence is unavailable from Google.
    missing.push(
      `Only ${data.totalNearby} mapped places within ${formatDistance(REACHABLE)} — this area looks ` +
      'lightly mapped in OpenStreetMap, so there may be shops and services we cannot see.'
    )
  } else if (data.sparselyMapped === null) {
    missing.push(
      'Place data comes from Google and varies in completeness between Indian ' +
      'cities — a low count in a less-mapped area may reflect the map, not the area.'
    )
  }

  return missing
}

function assess(walkability, categories) {
  const label =
    walkability >= 75 ? 'Most daily needs within a short walk' :
    walkability >= 50 ? 'Walkable for essentials, some errands need a ride' :
    walkability >= 25 ? 'Limited on foot — expect to use a vehicle' :
    'Car or auto needed for almost everything'

  const absent = categories
    .filter((c) => c.weight >= 2 && (c.nearestM === null || c.nearestM > WALKABLE))
    .map((c) => c.label.toLowerCase())

  // Distance-anchored, not a minutes claim: 800 m is ~13 min at the declared
  // walking method, so "a 10-minute walk" contradicted our own arithmetic.
  const detail = absent.length
    ? `No ${absent.join(' or ')} within 800 m.`
    : 'Groceries, pharmacy and healthcare are all within 800 m of here.'

  return { label, detail }
}
