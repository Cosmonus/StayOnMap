// Where StayOnMap is open — the ONE city table on the backend.
//
// Until 2026-08-24 this was nine metro cities. Operator decision that day:
// open the STATES those nine sit in. A state is expressed as its cities,
// because everything downstream — signup, listing validation, the spatial
// layer's `resolveCity()`, the POI/boundary/road/water seeders, the SEO city
// pages, the pincode check — keys on a city name with a centre and a radius,
// and that model needs no rewrite to hold forty cities instead of nine. A town
// not in this table still lands on the waitlist, and admin → Waitlist → by
// city is how the NEXT entries get chosen.
//
// Mirrors frontend/src/config/cities.js and mobile/src/config/cities.js (name +
// state, same order). backend/tests/cities-parity.test.js fails on drift.
//
// `radiusKm` is the metro-area reach `resolveCity()` and the seeders use — a
// soft "plausibly in this city" signal, NOT a boundary. `core` marks the nine
// original metros: the ones with a metro network, curated areas and a homepage
// pill. Adding a city is one row here plus one in each client mirror, then
// the seeders on the box (docs/operator-actions.md §1.6j).

const DELHI = 'Delhi'
const MAHARASHTRA = 'Maharashtra'
const WEST_BENGAL = 'West Bengal'
const TAMIL_NADU = 'Tamil Nadu'
const KARNATAKA = 'Karnataka'
const TELANGANA = 'Telangana'
const GUJARAT = 'Gujarat'

export const CITY_TABLE = [
  // ── The nine metros ──────────────────────────────────────────────────────
  { name: 'Delhi',     state: DELHI,       lat: 28.6139, lng: 77.2090, radiusKm: 60, core: true },
  { name: 'Mumbai',    state: MAHARASHTRA, lat: 19.0760, lng: 72.8777, radiusKm: 55, core: true },
  { name: 'Kolkata',   state: WEST_BENGAL, lat: 22.5726, lng: 88.3639, radiusKm: 45, core: true },
  { name: 'Chennai',   state: TAMIL_NADU,  lat: 13.0827, lng: 80.2707, radiusKm: 45, core: true },
  { name: 'Bengaluru', state: KARNATAKA,   lat: 12.9716, lng: 77.5946, radiusKm: 45, core: true },
  { name: 'Hyderabad', state: TELANGANA,   lat: 17.3850, lng: 78.4867, radiusKm: 45, core: true },
  { name: 'Ahmedabad', state: GUJARAT,     lat: 23.0225, lng: 72.5714, radiusKm: 40, core: true },
  { name: 'Pune',      state: MAHARASHTRA, lat: 18.5204, lng: 73.8567, radiusKm: 45, core: true },
  { name: 'Surat',     state: GUJARAT,     lat: 21.1702, lng: 72.8311, radiusKm: 35, core: true },

  // ── Maharashtra ──────────────────────────────────────────────────────────
  { name: 'Nagpur',                   state: MAHARASHTRA, lat: 21.1458, lng: 79.0882, radiusKm: 30 },
  { name: 'Nashik',                   state: MAHARASHTRA, lat: 19.9975, lng: 73.7898, radiusKm: 25 },
  { name: 'Chhatrapati Sambhajinagar', state: MAHARASHTRA, lat: 19.8762, lng: 75.3433, radiusKm: 25 },
  { name: 'Solapur',                  state: MAHARASHTRA, lat: 17.6599, lng: 75.9064, radiusKm: 20 },
  { name: 'Kolhapur',                 state: MAHARASHTRA, lat: 16.7050, lng: 74.2433, radiusKm: 20 },
  { name: 'Amravati',                 state: MAHARASHTRA, lat: 20.9320, lng: 77.7523, radiusKm: 20 },

  // ── West Bengal ──────────────────────────────────────────────────────────
  { name: 'Siliguri', state: WEST_BENGAL, lat: 26.7271, lng: 88.3953, radiusKm: 20 },
  { name: 'Durgapur', state: WEST_BENGAL, lat: 23.5204, lng: 87.3119, radiusKm: 20 },
  { name: 'Asansol',  state: WEST_BENGAL, lat: 23.6889, lng: 86.9661, radiusKm: 20 },

  // ── Tamil Nadu ───────────────────────────────────────────────────────────
  { name: 'Coimbatore',      state: TAMIL_NADU, lat: 11.0168, lng: 76.9558, radiusKm: 30 },
  { name: 'Madurai',         state: TAMIL_NADU, lat: 9.9252,  lng: 78.1198, radiusKm: 25 },
  { name: 'Tiruchirappalli', state: TAMIL_NADU, lat: 10.7905, lng: 78.7047, radiusKm: 25 },
  { name: 'Salem',           state: TAMIL_NADU, lat: 11.6643, lng: 78.1460, radiusKm: 20 },
  { name: 'Tiruppur',        state: TAMIL_NADU, lat: 11.1085, lng: 77.3411, radiusKm: 20 },
  { name: 'Erode',           state: TAMIL_NADU, lat: 11.3410, lng: 77.7172, radiusKm: 20 },
  { name: 'Vellore',         state: TAMIL_NADU, lat: 12.9165, lng: 79.1325, radiusKm: 20 },
  { name: 'Tirunelveli',     state: TAMIL_NADU, lat: 8.7139,  lng: 77.7567, radiusKm: 20 },
  { name: 'Thoothukudi',     state: TAMIL_NADU, lat: 8.7642,  lng: 78.1348, radiusKm: 20 },
  { name: 'Hosur',           state: TAMIL_NADU, lat: 12.7409, lng: 77.8253, radiusKm: 15 },

  // ── Karnataka ────────────────────────────────────────────────────────────
  { name: 'Mysuru',           state: KARNATAKA, lat: 12.2958, lng: 76.6394, radiusKm: 25 },
  { name: 'Mangaluru',        state: KARNATAKA, lat: 12.9141, lng: 74.8560, radiusKm: 25 },
  { name: 'Hubballi-Dharwad', state: KARNATAKA, lat: 15.3647, lng: 75.1240, radiusKm: 25 },
  { name: 'Belagavi',         state: KARNATAKA, lat: 15.8497, lng: 74.4977, radiusKm: 20 },
  { name: 'Davanagere',       state: KARNATAKA, lat: 14.4644, lng: 75.9218, radiusKm: 20 },
  { name: 'Ballari',          state: KARNATAKA, lat: 15.1394, lng: 76.9214, radiusKm: 20 },
  { name: 'Shivamogga',       state: KARNATAKA, lat: 13.9299, lng: 75.5681, radiusKm: 20 },
  { name: 'Tumakuru',         state: KARNATAKA, lat: 13.3379, lng: 77.1173, radiusKm: 20 },
  { name: 'Udupi',            state: KARNATAKA, lat: 13.3409, lng: 74.7421, radiusKm: 20 },

  // ── Telangana ────────────────────────────────────────────────────────────
  { name: 'Warangal',   state: TELANGANA, lat: 17.9689, lng: 79.5941, radiusKm: 25 },
  { name: 'Nizamabad',  state: TELANGANA, lat: 18.6725, lng: 78.0941, radiusKm: 20 },
  { name: 'Karimnagar', state: TELANGANA, lat: 18.4386, lng: 79.1288, radiusKm: 20 },
  { name: 'Khammam',    state: TELANGANA, lat: 17.2473, lng: 80.1514, radiusKm: 20 },

  // ── Gujarat ──────────────────────────────────────────────────────────────
  { name: 'Vadodara',  state: GUJARAT, lat: 22.3072, lng: 73.1812, radiusKm: 30 },
  { name: 'Rajkot',    state: GUJARAT, lat: 22.3039, lng: 70.8022, radiusKm: 30 },
  { name: 'Bhavnagar', state: GUJARAT, lat: 21.7645, lng: 72.1519, radiusKm: 20 },
  { name: 'Jamnagar',  state: GUJARAT, lat: 22.4707, lng: 70.0577, radiusKm: 20 },
  { name: 'Junagadh',  state: GUJARAT, lat: 21.5222, lng: 70.4579, radiusKm: 20 },
  { name: 'Anand',     state: GUJARAT, lat: 22.5645, lng: 72.9289, radiusKm: 20 },
]

export const SUPPORTED_STATES = [DELHI, MAHARASHTRA, WEST_BENGAL, TAMIL_NADU, KARNATAKA, TELANGANA, GUJARAT]

// Where tenants can sign up from AND where owners can list. Derived, so the
// two can no longer drift — they had been three independently hardcoded lists
// once already (roadmap P7 addendum 2).
export const SUPPORTED_CITIES = CITY_TABLE.map((c) => c.name)

export const CORE_CITIES = CITY_TABLE.filter((c) => c.core).map((c) => c.name)

// The state each city sits in, AS INDIA POST SPELLS IT (upper case, their
// convention) — used to check a listing's claimed pincode against the city it
// claims to be in. Delhi is 'DELHI' in the postal directory, not 'NCT of
// Delhi' as OSM has it; the comparison must use the source's own vocabulary or
// every Delhi listing would be flagged.
export const STATE_OF_CITY = Object.fromEntries(CITY_TABLE.map((c) => [c.name, c.state.toUpperCase()]))

// The states a city's METRO AREA actually spans — which is not the same
// question as STATE_OF_CITY above, and conflating them produced ~15,000 false
// findings on the first production run.
//
// `CITY_CENTERS` gives Delhi a 60 km radius, so `resolveCity()` labels POIs in
// Gurgaon, Noida, Ghaziabad and Bhiwadi as `city: 'Delhi'`. Their pincodes are
// genuinely Haryana, Uttar Pradesh and Rajasthan, so India Post disagreed with
// 'DELHI' for 44% of Delhi's pincoded POIs — every one of them correctly mapped.
// Our `city` is a metro-area label, not an administrative one.
//
// MEASURED, then declared — not derived. The extra entries below are here
// because the metro genuinely crosses a state line, and each is a real
// administrative fact: the National Capital Region is legally defined across
// exactly these four states, and Bengaluru's built-up area reaches Hosur in
// Tamil Nadu, ~40 km from the centre.
//
// What is deliberately NOT here is just as important. The same query showed
// Mumbai→West Bengal (1 row), Bengaluru→Bihar (4), Hyderabad→Odisha (15) and
// Pune→Uttar Pradesh (31). Those states are nowhere near those cities; they are
// mapper typos in `addr:postcode`, and they are precisely what the check exists
// to catch. Widening this table to whatever the data contained would launder
// every real error into the allowlist and leave verification unable to fail.
//
// Rule for adding an entry: the two places must be one continuous urban area.
// If you cannot name the suburb, it is a typo, not a metro.
const METRO_STATES = {
  // The NCR, as constituted: Delhi, Haryana (Gurgaon, Faridabad), Uttar
  // Pradesh (Noida, Ghaziabad), Rajasthan (Bhiwadi, Alwar district).
  Delhi: ['DELHI', 'HARYANA', 'UTTAR PRADESH', 'RAJASTHAN'],
  // Hosur sits inside the 45 km radius and is functionally Bengaluru's
  // industrial edge. (Hosur is also its own row now; resolveCity() picks the
  // NEARER centre, so a Hosur pin is labelled Hosur and this spill only
  // covers the stretch between.)
  Bengaluru: ['KARNATAKA', 'TAMIL NADU'],
}

/**
 * Every state a POI in this city may legitimately carry a pincode from.
 *
 * Falls back to the single state above, so a city with no metro spill needs no
 * entry — and an unknown city returns an empty list, which callers must read as
 * "cannot check" rather than "everything is wrong".
 *
 * @param {string} city
 * @returns {string[]} India Post's spellings, upper case
 */
export function statesOfMetro(city) {
  const spread = METRO_STATES[city]
  if (spread) return spread
  const single = STATE_OF_CITY[city]
  return single ? [single] : []
}
