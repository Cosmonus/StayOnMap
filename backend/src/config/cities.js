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
