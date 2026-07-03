// Routed through the StayOnMap backend (see backend/src/features/places),
// not called against Google directly — the Google Maps API key shipped to
// this app is HTTP-referrer restricted (required for the web JS Maps SDK),
// and Google rejects any request with no browser Referer header outright,
// which is every request a mobile app makes. The backend calls Google with
// its own server-side key instead.
import { api } from './api'

export async function autocompletePlaces(input, cityBias) {
  if (!input?.trim()) return []
  const params = { input }
  if (cityBias) {
    params.lat = cityBias.lat
    params.lng = cityBias.lng
  }
  const res = await api.get('/places/autocomplete', { params })
  return res.data ?? []
}
