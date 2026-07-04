// Mirrors frontend/src/store/filterStore.js
import { create } from 'zustand'

const defaultFilters = {
  city: '', // one of config/cities.js's CITY_NAMES, or ''
  area: '',
  bhk: [],
  furnished: null,
}

export const useFilterStore = create((set) => ({
  filters: { ...defaultFilters },

  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}))
