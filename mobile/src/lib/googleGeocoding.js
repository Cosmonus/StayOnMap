// Routed through the StayOnMap backend (see backend/src/features/places),
// not called against Google directly — see googlePlaces.js for why (an
// HTTP-referrer-restricted key rejects any request with no browser Referer,
// which is every request a mobile app makes).
import { api } from './api'

export async function geocodeAddress(address) {
  if (!address?.trim()) return null
  const res = await api.get('/places/geocode', { params: { address } })
  return res.data ?? null
}
