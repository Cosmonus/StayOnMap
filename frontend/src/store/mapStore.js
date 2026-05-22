// Map viewport state + selected property pin
import { create } from 'zustand'

export const useMapStore = create((set) => ({
  center: [78.9629, 20.5937],
  zoom: 5,
  bounds: null,
  pins: [],
  selectedPinId: null,
  selectedPinRect: null,

  flyTo: null,
  searchedPlace: null,

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
  setSearchedPlace: (place) => set({ searchedPlace: place }),
  toggleLayer: (name) => set((s) => ({
    activeLayers: { ...s.activeLayers, [name]: !s.activeLayers[name] },
  })),
  setSelectedArea: (area) => set({ selectedArea: area }),
}))
