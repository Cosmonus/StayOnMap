// Map viewport state + selected pin. Mirrors frontend/src/store/mapStore.js's
// field names and the flyTo-as-injected-function pattern, but NOT its shapes —
// RN uses {latitude, longitude} region objects, not Google Maps' [lng, lat]
// array / LatLngBounds instances.
import { create } from 'zustand'

export const useMapStore = create((set) => ({
  region: { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 20, longitudeDelta: 20 },
  bounds: null, // { swLat, swLng, neLat, neLng } — derived from region on each change
  pins: [],
  selectedPinId: null,

  flyTo: null, // (opts: {latitude, longitude, zoom}) => void — set once MapView mounts
  searchedPlace: null, // { lat, lng }
  selectedArea: null,

  setRegion: (region) => set({ region }),
  setBounds: (bounds) => set({ bounds }),
  setPins: (pins) => set({ pins }),
  selectPin: (id) => set({ selectedPinId: id }),
  clearSelection: () => set({ selectedPinId: null }),
  setFlyTo: (fn) => set({ flyTo: fn }),
  setSearchedPlace: (place) => set({ searchedPlace: place }),
  setSelectedArea: (area) => set({ selectedArea: area }),
}))
