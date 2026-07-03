// Cities StayOnMap is open to signups in — mirrors frontend/src/config/cities.js
// and mobile/src/config/cities.js's CITY_NAMES (map/browsing scope). Kept as
// its own constant (not imported from properties.validation.js or vice versa)
// since it's a conceptually separate rule — where tenants can sign up from —
// even though as of 2026-07-03 it happens to list the same 9 cities as
// properties.validation.js's listing-creation restriction.
export const SUPPORTED_CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Pune', 'Surat']
