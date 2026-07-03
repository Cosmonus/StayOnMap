// Map viewport state + selected pin. Mirrors frontend/src/store/mapStore.js's
// field names and the flyTo-as-injected-function pattern, but NOT its shapes —
// RN uses {latitude, longitude} region objects, not Google Maps' [lng, lat]
// array / LatLngBounds instances.
import { create } from 'zustand'

// Bounds all 9 supported cities (see config/cities.js) with padding — not an
// arbitrary whole-India delta. MapView's initial pins fetch reads this region
// before onMapReady's fitToCoordinates() settles, so it must already cover
// every city, otherwise pins load clustered at the wrong zoom (or missing
// entirely for cities outside the delta) until the user pans. Latitude spans
// Bengaluru (12.97) to Delhi (28.61); longitude spans Ahmedabad (72.57) to
// Kolkata (88.36) — widened from the original 4-city delta when Mumbai/
// Kolkata/Ahmedabad/Pune/Surat were added, since Kolkata's longitude in
// particular sat well outside the old ±4° window.
export const INITIAL_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 18, longitudeDelta: 20 }

export const useMapStore = create((set) => ({
  region: INITIAL_REGION,
  bounds: null, // { swLat, swLng, neLat, neLng } — derived from region on each change
  pins: [],
  selectedPinId: null,
  selectedAreaSlug: null, // area-profile slug (neighborhood intelligence card) — mutually exclusive with selectedPinId

  flyTo: null, // (opts: {latitude, longitude, zoom}) => void — set once MapView mounts
  searchedPlace: null, // { lat, lng }

  setRegion: (region) => set({ region }),
  setBounds: (bounds) => set({ bounds }),
  setPins: (pins) => set({ pins }),
  selectPin: (id) => set({ selectedPinId: id, selectedAreaSlug: null }),
  clearSelection: () => set({ selectedPinId: null, selectedAreaSlug: null }),
  setSelectedAreaSlug: (slug) => set({ selectedAreaSlug: slug, selectedPinId: null }),
  setFlyTo: (fn) => set({ flyTo: fn }),
  setSearchedPlace: (place) => set({ searchedPlace: place }),
}))
