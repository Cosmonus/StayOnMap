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
  // Daily needs.
  //
  // `general` and `grocery` added 2026-07-20 after an audit against India tag
  // counts: they are +34% on top of supermarket+convenience. In India the
  // kirana — not the supermarket — decides whether you can buy milk without a
  // vehicle, and `shop=general` is exactly that tag. `grocery` is current, not
  // a deprecated synonym.
  //
  // `amenity=marketplace` (3,937 in India) is deliberately its OWN category
  // below rather than folded in here: a weekly sabzi mandi and a shop open at
  // 9pm answer different questions, and merging them makes "nearest groceries"
  // unfalsifiable.
  supermarket: { amenity: [], shop: ['supermarket', 'convenience', 'greengrocer', 'general', 'grocery'], leisure: [] },
  marketplace: { amenity: ['marketplace'], shop: [], leisure: [] },
  pharmacy:    { amenity: ['pharmacy'], shop: ['chemist'], leisure: [] },

  // Civic. Hospitals and clinics are separate categories (split 2026-07-19)
  // so the detail lists can tell an emergency ward from a GP — modules that
  // mean "nearest care of any kind" merge the two at query time (see
  // lifestyle's poiKeys). Rows seeded before the split sit under `hospital`;
  // a re-run of scripts/fetch-osm-pois.mjs reclassifies them in place.
  // `healthcare=*` added 2026-07-20. India/Tags/healthcare recommends that
  // scheme over `amenity=*`, and a large health-facility import used it — so
  // reading `amenity` alone missed anything tagged the recommended way.
  //
  // Probed before adding rather than trusting the national count: in a 6km box
  // over central Bengaluru only 26 objects carry `healthcare` WITHOUT an
  // `amenity`, so the gap is real but modest, not the tens of thousands the
  // raw tag count implies. Most facilities are dual-tagged and were already
  // being found.
  //
  // Only the values that mean "somewhere to get care" are folded in. The probe
  // showed the rest is specialists and diagnostics — physiotherapist,
  // optometrist, psychotherapist, rehabilitation, nursing, alternative — and
  // calling any of those "the nearest clinic" would overstate what is there.
  hospital:    { amenity: ['hospital'], shop: [], leisure: [], healthcare: ['hospital'] },
  clinic:      { amenity: ['clinic', 'doctors'], shop: [], leisure: [], healthcare: ['clinic', 'centre', 'doctor'] },
  // NOT a `diagnostics` category. One was added earlier today on the strength
  // of ten lab rows in a single probe, and it failed the test that matters:
  // nobody chooses a flat by proximity to a blood-test lab. Labs stay unmapped
  // rather than becoming a category, and rather than being folded into `clinic`
  // — which would inflate "nearest care" with places that cannot treat you.
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
  // `leisure=garden` removed 2026-07-20. The OSM wiki is explicit that its most
  // common form "is known as a residential garden and is generally found in
  // proximity to a residence" — so counting them made apartment-complex
  // landscaping read as public parks.
  //
  // Filtering instead of dropping was considered and rejected: only 12.8% of
  // Indian gardens carry `garden:type=*` at all, and among those, private
  // slightly outnumbers public. The signal needed to keep the good ones does
  // not exist on 87% of rows.
  //
  // Expect roughly a sixth off this category, not half — `leisure=park` is
  // genuinely the most-mapped leisure value in India, so the size of this
  // category was mostly real.
  park:        { amenity: [], shop: [], leisure: ['park'] },
  // `amenity=gym` removed: exactly ONE object carries it in all of India, while
  // `leisure=fitness_centre` (already here) carries 2,330. Not formally
  // deprecated by the wiki, just vanishingly rare — removing it changes no
  // count and stops the file implying the tag matters.
  gym:         { amenity: [], shop: [], leisure: ['fitness_centre'] },

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
  // `aeroway=international_airport` removed: it is not a valid value — Key:aeroway
  // documents 34 and that is not among them, and it matches 0 objects in India.
  // It was inert, which means the intent behind it was never implemented.
  //
  // `requires` is what implements it. `aeroway=aerodrome` covers all 414 Indian
  // aerodromes including flying clubs and air-force strips; subtags do not
  // rescue it (only 16 carry `aerodrome=*`, and `private` outnumbers
  // `international`). An IATA code is the closest free proxy for "an airline
  // actually flies here" — a tag, not a heuristic. "Airport 4 km away" pointing
  // at a military airfield is a trust-destroying fact for a short-stay guest,
  // and one they catch instantly.
  airport: {
    amenity: [], shop: [], leisure: [], aeroway: ['aerodrome'],
    requires: (tags) => Boolean(tags.iata) && tags.military !== 'airfield',
    // What `requires` wants, as data. Documents the predicate for a reader and
    // lets the reachability test tell "gated" apart from "shadowed" — without
    // it, a category behind a gate looks identical to one made unreachable by
    // an earlier rule, which is the bug that test exists to catch.
    requiresSample: { iata: 'BLR' },
  },
  // `halt` added: "a small station, may not have a platform", de facto and not
  // deprecated, 1,250 in India. Mostly rural, so modest inside the 9 cities.
  //
  // NOT split into metro vs suburban rail, though it should be. Indian metro
  // stations are already captured here (the convention is `railway=station` +
  // `station=subway`, 1,182 in India) — the subtag is in what we fetch and we
  // discard it. "Nearest station 600 m" means a daily commute or a twice-a-year
  // trip depending on which it is. Splitting touches mobility, stayContext and
  // commerce, so it is its own change rather than a rider on a re-seed.
  // Metro FIRST, so it wins the first-match-wins scan before the general rail
  // rule below can swallow it.
  //
  // Indian metro stations are `railway=station` + `station=subway` (1,182 in
  // India) — the subtag was always in what we fetch and we were discarding it,
  // merging Mumbai suburban, long-distance IR and metro into one fact. "Nearest
  // station 600 m" means a daily commute or a twice-a-year trip depending which
  // it is, and those are different products for a renter.
  //
  // `light_rail` included: Delhi's Rapid Metro and Gurgaon carry it, and a
  // rider does not experience it as a different mode.
  metro_station: {
    amenity: [], shop: [], leisure: [], railway: ['station'],
    requires: (tags) => tags.station === 'subway' || tags.station === 'light_rail',
    requiresSample: { station: 'subway' },
  },
  // Everything else on rails: suburban and long-distance. `halt` is "a small
  // station, may not have a platform" — de facto, not deprecated, 1,250 in
  // India, mostly rural so modest inside the 9 cities.
  railway_station: { amenity: [], shop: [], leisure: [], railway: ['station', 'halt'] },
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
    // `department_store` added: the wiki separates it from a mall ("a single
    // large shop with many departments") and it is a strong footfall anchor.
    shop: ['clothes', 'electronics', 'hardware', 'furniture', 'mobile_phone',
           'jewelry', 'bakery', 'butcher', 'books', 'shoes', 'beauty',
           'optician', 'florist', 'stationery', 'sports', 'toys',
           'department_store'],
  },
  // `mall` moved OUT of retail 2026-07-20. The basket is a footfall proxy, and
  // a mall holding 120 shops contributed exactly one row — the same as a single
  // florist. That systematically under-weighted the highest-footfall locations
  // in the index, inverting the signal COMMERCIAL wants. "3 malls within 2 km"
  // is also a better commercial fact than a count that hides them.
  mall:        { amenity: [], shop: ['mall'], leisure: [] },
}

// Tag keys the vocabulary uses beyond amenity/shop/leisure. Listed once so
// categoryFor() and overpassClauses() can't drift apart.
const EXTRA_KEYS = ['aeroway', 'railway', 'tourism', 'healthcare']

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
      if (!value || !rules[key]?.includes(value)) continue
      // A category may demand more than one tag. `requires` failing means this
      // element is NOT that category — and, because the loop continues rather
      // than returns, it stays eligible for a later one. An aerodrome with no
      // IATA code simply goes unmapped, which is the honest outcome.
      if (rules.requires && !rules.requires(tags)) continue
      return { category, sourceTag: `${key}=${value}` }
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
