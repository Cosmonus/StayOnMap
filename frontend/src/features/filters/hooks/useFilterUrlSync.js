// Two-way sync between the filter store and the URL query string, so a
// filtered map view is shareable/bookmarkable and survives reloads.
// Mount once on map pages. Uses history.replaceState (no navigation, no
// page reload, no history spam while toggling chips).
import { useEffect, useRef } from 'react'
import { useFilterStore } from '@store/filterStore'
import { toQueryParams, parseFiltersFromSearch, PARAM_DEFS, DEFAULT_FILTERS } from '@/config/filters'

export function useFilterUrlSync() {
  const filters = useFilterStore((s) => s.filters)
  const setFilters = useFilterStore((s) => s.setFilters)
  const hydrated = useRef(false)

  // Captured during the first RENDER, before any effect can touch the URL.
  //
  // Reading window.location inside the hydrate effect is not safe: the
  // store→URL effect below runs in the same commit holding the pre-hydration
  // (all-default) filters, so it rewrites the URL bare — and StrictMode then
  // re-runs the hydrate effect, which re-parses that now-empty string and
  // resets every filter. /properties?city=Bengaluru arrived, and rendered as
  // an unfiltered "All properties" with a stripped URL.
  const initialSearch = useRef(null)
  if (initialSearch.current === null) initialSearch.current = window.location.search

  // URL → store, once on mount. The URL is AUTHORITATIVE: anything it does not
  // mention resets to its default.
  //
  // Previously this only applied the params it found, and the store is global
  // and outlives the route. So following "Also renting nearby" to
  // /properties?city=Bengaluru left city=Bengaluru in the store, and coming
  // back to the bare map homepage kept it — the map silently showed Bengaluru
  // only, with an empty search box and no hint why. It read as "the listings
  // failed to load" rather than "a filter is still on".
  useEffect(() => {
    const fromUrl = parseFiltersFromSearch(new URLSearchParams(initialSearch.current))
    setFilters({ ...DEFAULT_FILTERS, ...fromUrl })
    hydrated.current = true
  }, [setFilters])

  // store → URL on every filter change.
  //
  // Rebuilt from the CURRENT query string rather than from scratch: this hook
  // only owns the keys in PARAM_DEFS, and replacing the whole search string
  // silently deleted everyone else's. That erased the map viewport the moment
  // any filter changed, so "See them as a list" handed the grid a viewport it
  // then dropped a tick later.
  useEffect(() => {
    if (!hydrated.current) return
    const params = new URLSearchParams(window.location.search)
    for (const [id, def] of Object.entries(PARAM_DEFS)) params.delete(def.param ?? id)
    for (const [key, value] of Object.entries(toQueryParams(filters))) params.set(key, value)

    const next = params.toString()
    const current = window.location.search.replace(/^\?/, '')
    if (next === current) return
    const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', url)
  }, [filters])
}
