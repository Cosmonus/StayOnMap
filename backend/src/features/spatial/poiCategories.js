// The spatial layer's POI vocabulary, and how it maps onto OpenStreetMap tags.
//
// One file because two things must agree exactly: scripts/fetch-osm-pois.mjs
// (which writes PoiIndex.category) and the modules that read it. A mismatch
// here fails silently — the category simply returns nothing, which reads as
// "no pharmacy nearby" rather than "we tagged it differently". The amenities
// system already learned this lesson the hard way; see
// scripts/check-amenities.mjs.
//
// Deliberately a small vocabulary. These are the categories that change where
// a person chooses to live, not everything OSM knows how to tag.

/**
 * category → the OSM tag values that map onto it.
 * Order matters only in that the first matching rule wins (see categoryFor).
 */
export const POI_CATEGORIES = {
  // Daily needs
  supermarket: { amenity: [], shop: ['supermarket', 'convenience', 'greengrocer'], leisure: [] },
  pharmacy:    { amenity: ['pharmacy'], shop: ['chemist'], leisure: [] },

  // Civic. Hospitals and clinics are separate categories (split 2026-07-19)
  // so the detail lists can tell an emergency ward from a GP — modules that
  // mean "nearest care of any kind" merge the two at query time (see
  // lifestyle's poiKeys). Rows seeded before the split sit under `hospital`;
  // a re-run of scripts/fetch-osm-pois.mjs reclassifies them in place.
  hospital:    { amenity: ['hospital'], shop: [], leisure: [] },
  clinic:      { amenity: ['clinic', 'doctors'], shop: [], leisure: [] },
  // 'college' removed from school's list (2026-07-19): categoryFor() is
  // first-match-wins, so school was capturing every amenity=college before
  // the dedicated `college` category below could — which left pgContext's
  // "nearest college" seeing only universities. A re-seed reclassifies.
  school:      { amenity: ['school', 'kindergarten'], shop: [], leisure: [] },
  government:  { amenity: ['townhall', 'post_office'], shop: [], leisure: [] },
  // Civic safety — added after the first seeds, so consumers must gate on
  // cityCategoryCoverage() before reading a zero as "none nearby" (see
  // infrastructure.module.js's sinceVocabularyV2).
  police:       { amenity: ['police'], shop: [], leisure: [] },
  fire_station: { amenity: ['fire_station'], shop: [], leisure: [] },

  // Leisure. `fast_food` deliberately does NOT appear here: categoryFor() is
  // first-match-wins, and listing it under restaurant (as it was until
  // 2026-07-19) made `food_cheap` below unreachable — every fast-food place
  // was stored as a restaurant and pgContext's cheap-eats signal saw only
  // food courts. Same bug class as the school/college fix above. Modules that
  // mean "anywhere to eat" union the two at query time (lifestyle's poiKeys,
  // stayContext's dining). A re-seed reclassifies stored rows in place.
  restaurant:  { amenity: ['restaurant'], shop: [], leisure: [] },
  cafe:        { amenity: ['cafe'], shop: [], leisure: [] },
  park:        { amenity: [], shop: [], leisure: ['park', 'garden'] },
  gym:         { amenity: ['gym'], shop: [], leisure: ['fitness_centre'] },

  // Infrastructure
  bank:        { amenity: ['bank'], shop: [], leisure: [] },
  atm:         { amenity: ['atm'], shop: [], leisure: [] },
  fuel:        { amenity: ['fuel'], shop: [], leisure: [] },
  ev_charging: { amenity: ['charging_station'], shop: [], leisure: [] },

  // Transit. Taxi stands surface only in the browseable nearby-places lists
  // (/api/v1/spatial/pois), never as a module fact — OSM's taxi-stand
  // coverage in India is too thin to headline a claim on.
  bus_stop:    { amenity: ['bus_station'], shop: [], leisure: [] },
  taxi:        { amenity: ['taxi'], shop: [], leisure: [] },

  // ── Type-specific. Each exists for a module that only some property types
  // see; see propertyTypes.js. Kept in the same table so one Overpass pass
  // collects everything and the vocabulary stays in one place.

  // SHORT_STAY: guests arrive before they do anything else, and then look for
  // something to do.
  airport:     { amenity: [], shop: [], leisure: [], aeroway: ['aerodrome', 'international_airport'] },
  railway_station: { amenity: [], shop: [], leisure: [], railway: ['station'] },
  attraction:  { amenity: [], shop: [], leisure: [], tourism: ['attraction', 'museum', 'viewpoint', 'zoo', 'theme_park'] },
  hotel:       { amenity: [], shop: [], leisure: [], tourism: ['hotel', 'guest_house', 'hostel'] },

  // PG: who the residents are and whether they can eat.
  college:     { amenity: ['college', 'university'], shop: [], leisure: [] },
  food_cheap:  { amenity: ['fast_food', 'food_court'], shop: [], leisure: [] },
  laundry:     { amenity: [], shop: ['laundry', 'dry_cleaning'], leisure: [] },

  // COMMERCIAL: a representative retail basket as a footfall proxy. NOT
  // `shop=*` — that returns tens of thousands of rows per tile and times the
  // Overpass query out. A bounded basket is a proxy either way, so a bigger
  // one buys nothing but risk.
  retail:      {
    amenity: [], leisure: [],
    shop: ['clothes', 'electronics', 'hardware', 'furniture', 'mobile_phone',
           'jewelry', 'bakery', 'butcher', 'books', 'shoes', 'beauty',
           'optician', 'florist', 'stationery', 'sports', 'toys', 'mall'],
  },
}

// Tag keys the vocabulary uses beyond amenity/shop/leisure. Listed once so
// categoryFor() and overpassClauses() can't drift apart.
const EXTRA_KEYS = ['aeroway', 'railway', 'tourism']

export const CATEGORY_KEYS = Object.keys(POI_CATEGORIES)

/**
 * Which of our categories does this OSM element belong to?
 * Returns null for anything we don't model — the query is broad, the
 * vocabulary is narrow, and unmatched elements are dropped rather than
 * force-fitted into the nearest category.
 */
export function categoryFor(tags = {}) {
  return classify(tags)?.category ?? null
}

/**
 * As `categoryFor`, but also returns WHICH tag matched.
 *
 * The tag is persisted on the row (`PoiIndex.sourceTag`) so the mapping stops
 * being a one-way door: "how many park rows actually came from leisure=garden"
 * is a question you can only ask if the answer was written down. Both
 * mis-groupings this vocabulary has already shipped — school swallowing
 * college, restaurant swallowing fast_food — were invisible in the stored data
 * and cost a full re-seed to correct.
 *
 * @returns {{category: string, sourceTag: string}|null}
 */
export function classify(tags = {}) {
  for (const [category, rules] of Object.entries(POI_CATEGORIES)) {
    for (const key of ['amenity', 'shop', 'leisure', ...EXTRA_KEYS]) {
      const value = tags[key]
      if (value && rules[key]?.includes(value)) {
        return { category, sourceTag: `${key}=${value}` }
      }
    }
  }
  // Bus stops are tagged on the highway key, not amenity.
  if (tags.highway === 'bus_stop') return { category: 'bus_stop', sourceTag: 'highway=bus_stop' }
  if (tags.office === 'government') return { category: 'government', sourceTag: 'office=government' }
  return null
}

/**
 * The Overpass filter clauses covering every category above.
 *
 * One union query per bounding box rather than one query per category: 14
 * sequential requests per tile would be both slower and ruder to a free
 * public API than a single union that returns the same rows.
 */
export function overpassClauses(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`

  const values = (key) => [
    ...new Set(Object.values(POI_CATEGORIES).flatMap((r) => r[key] ?? [])),
  ].filter(Boolean)

  // nwr = node|way|relation. Many Indian POIs are mapped as building polygons
  // rather than points, so restricting to nodes would silently lose a large
  // share of exactly the categories that matter (hospitals, schools, malls,
  // airports).
  const clauses = ['amenity', 'shop', 'leisure', ...EXTRA_KEYS]
    .map((key) => {
      const vals = values(key)
      return vals.length ? `nwr["${key}"~"^(${vals.join('|')})$"](${b});` : null
    })
    .filter(Boolean)

  return [
    ...clauses,
    `nwr["office"="government"](${b});`,
    `node["highway"="bus_stop"](${b});`,
  ].join('\n  ')
}
