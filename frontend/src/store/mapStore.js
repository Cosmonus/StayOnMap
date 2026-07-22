// Map viewport state + selected property pin
import { create } from 'zustand'

// Only ever set to 'granted' — a "Not now" is not persisted, so a declined
// user sees our explainer dialog again on the next locate tap.
const LOCATION_CONSENT_KEY = 'sn_location_consent'

export const useMapStore = create((set) => ({
  center: [78.9629, 20.5937],
  zoom: 5,
  bounds: null,
  pins: [],
  selectedPinId: null,
  selectedPinRect: null,

  flyTo: null,
  searchedPlace: null,

  // Whether the user has accepted our "Turn on location?" explainer — the
  // browser's own permission prompt is never triggered before this is true.
  locationConsent: localStorage.getItem(LOCATION_CONSENT_KEY) === 'granted',

  // Map overlay layers
  activeLayers: {
    metro:       false,
    itCorridors: false,
    floodZones:  false,
    traffic:     false,
  },
  selectedArea: null,

  setViewport: (center, zoom) => set({ center, zoom }),
  setBounds: (bounds) => set({ bounds }),
  setPins: (pins) => set({ pins }),
  selectPin: (id, rect) => set({ selectedPinId: id, selectedPinRect: rect ?? null }),
  clearSelection: () => set({ selectedPinId: null, selectedPinRect: null }),
  setFlyTo: (fn) => set({ flyTo: fn }),
  grantLocationConsent: () => {
    localStorage.setItem(LOCATION_CONSENT_KEY, 'granted')
    set({ locationConsent: true })
  },
  setSearchedPlace: (place) => set({ searchedPlace: place }),
  toggleLayer: (name) => set((s) => ({
    activeLayers: { ...s.activeLayers, [name]: !s.activeLayers[name] },
  })),
  setSelectedArea: (area) => set({ selectedArea: area }),
}))
