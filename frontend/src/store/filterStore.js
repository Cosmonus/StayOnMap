// Global search + filter state
import { create } from 'zustand'

const defaultFilters = {
  city:      '',   // one of config/cities.js's CITY_NAMES, or ''
  area:      '',   // free-text area / landmark
  bhk:       [],   // e.g. [1, 2, 3]
  furnished: null,
}

export const useFilterStore = create((set) => ({
  filters: { ...defaultFilters },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),
}))
