// RN has no google.maps.Geocoder class (that's part of the JS Maps SDK,
// which only runs in a browser) — call the REST Geocoding API directly.
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function geocodeAddress(address) {
  const params = new URLSearchParams({
    address,
    region: 'in',
    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  })
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`)
  const data = await res.json()
  const result = data.results?.[0]
  if (data.status !== 'OK' || !result) return null
  return { lat: result.geometry.location.lat, lng: result.geometry.location.lng }
}
