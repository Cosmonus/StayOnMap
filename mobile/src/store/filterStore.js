// Mirrors frontend/src/store/filterStore.js — shape defined by
// config/filters.js (city/area search context plus every filter id).
import { create } from 'zustand'
import { DEFAULT_FILTERS, SEARCH_KEYS } from '@config/filters'

export const useFilterStore = create((set) => ({
  filters: { ...DEFAULT_FILTERS },

  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),

  // Full reset — search context included
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  // Sheet "Clear all" — resets every filter but keeps where the user is looking
  clearFilters: () =>
    set((state) => ({
      filters: {
        ...DEFAULT_FILTERS,
        ...Object.fromEntries(SEARCH_KEYS.map((k) => [k, state.filters[k]])),
      },
    })),
}))
