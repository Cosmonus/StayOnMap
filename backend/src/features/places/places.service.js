// Proxies Google's Geocoding + Places Autocomplete REST APIs using the
// server-side GOOGLE_MAPS_KEY (same key trust.service.js already uses for
// Nearby Search/Elevation). Mobile can't call these directly — an HTTP
// referrer-restricted key (needed for the web JS Maps SDK) is rejected
// outright by Google on any request with no browser Referer header, which
// is every request a mobile app or curl-style fetch makes.
import { env } from '../../config/env.js'

const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function autocomplete(input, lat, lng) {
  if (!input?.trim() || !env.googleMapsKey) return []
  const params = new URLSearchParams({
    input,
    key: env.googleMapsKey,
    components: 'country:in',
    types: 'geocode',
  })
  if (lat != null && lng != null) {
    params.set('location', `${lat},${lng}`)
    params.set('radius', '30000')
  }
  const data = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`).then((r) => r.json())
  if (data.status === 'ZERO_RESULTS') return []
  if (data.status !== 'OK') {
    throw Object.assign(new Error(data.error_message || data.status || 'Places Autocomplete request failed'), { statusCode: 502 })
  }
  return data.predictions ?? []
}

export async function geocode(address) {
  if (!address?.trim() || !env.googleMapsKey) return null
  const params = new URLSearchParams({ address, region: 'in', key: env.googleMapsKey })
  const data = await fetch(`${GEOCODE_URL}?${params.toString()}`).then((r) => r.json())
  if (data.status === 'ZERO_RESULTS') return null
  if (data.status !== 'OK') {
    // Same distinction as autocomplete() — a real API failure (bad key,
    // Geocoding API not enabled, over quota) must not look identical to a
    // legitimate "that place doesn't exist" result.
    throw Object.assign(new Error(data.error_message || data.status || 'Geocoding request failed'), { statusCode: 502 })
  }
  const result = data.results?.[0]
  if (!result) return null
  return { lat: result.geometry.location.lat, lng: result.geometry.location.lng }
}
