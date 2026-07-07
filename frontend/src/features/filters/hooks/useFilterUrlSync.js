// Two-way sync between the filter store and the URL query string, so a
// filtered map view is shareable/bookmarkable and survives reloads.
// Mount once on map pages. Uses history.replaceState (no navigation, no
// page reload, no history spam while toggling chips).
import { useEffect, useRef } from 'react'
import { useFilterStore } from '@store/filterStore'
import { toQueryParams, parseFiltersFromSearch } from '@/config/filters'

export function useFilterUrlSync() {
  const filters = useFilterStore((s) => s.filters)
  const setFilters = useFilterStore((s) => s.setFilters)
  const hydrated = useRef(false)

  // URL → store, once on mount
  useEffect(() => {
    const patch = parseFiltersFromSearch(new URLSearchParams(window.location.search))
    if (Object.keys(patch).length) setFilters(patch)
    hydrated.current = true
  }, [setFilters])

  // store → URL on every filter change
  useEffect(() => {
    if (!hydrated.current) return
    const next = new URLSearchParams(toQueryParams(filters)).toString()
    const current = window.location.search.replace(/^\?/, '')
    if (next === current) return
    const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', url)
  }, [filters])
}
