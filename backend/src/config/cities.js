// Cities StayOnMap is open to signups in — mirrors frontend/src/config/cities.js
// and mobile/src/config/cities.js's CITY_NAMES (map/browsing scope). Kept as
// its own constant (not imported from properties.validation.js or vice versa)
// since it's a conceptually separate rule — where tenants can sign up from —
// even though as of 2026-07-03 it happens to list the same 9 cities as
// properties.validation.js's listing-creation restriction.
export const SUPPORTED_CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Pune', 'Surat']

// The state each supported city sits in, AS INDIA POST SPELLS IT (upper case,
// their convention) — used to check a listing's claimed pincode against the
// city it claims to be in. Delhi is 'DELHI' in the postal directory, not
// 'NCT of Delhi' as OSM has it; the comparison must use the source's own
// vocabulary or every Delhi listing would be flagged.
export const STATE_OF_CITY = {
  Delhi: 'DELHI',
  Mumbai: 'MAHARASHTRA',
  Kolkata: 'WEST BENGAL',
  Chennai: 'TAMIL NADU',
  Bengaluru: 'KARNATAKA',
  Hyderabad: 'TELANGANA',
  Ahmedabad: 'GUJARAT',
  Pune: 'MAHARASHTRA',
  Surat: 'GUJARAT',
}

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
  // industrial edge.
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
