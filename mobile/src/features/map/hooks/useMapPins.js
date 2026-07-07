import { useCallback, useEffect, useRef } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { propertyService } from '@services/property.service'
import { toQueryParams } from '@config/filters'
import { regionToBounds } from '../utils/regionZoom'

const DEBOUNCE_MS = 400

// Mirrors frontend/src/features/map/hooks/useMapBounds.js's bounds→pins loop,
// adapted to RN's declarative onRegionChangeComplete instead of an imperative
// Google Maps 'idle' listener.
export function useMapPins() {
  const setPins = useMapStore((s) => s.setPins)
  const setBounds = useMapStore((s) => s.setBounds)
  const setRegion = useMapStore((s) => s.setRegion)
  const filters = useFilterStore((s) => s.filters)
  const debounceRef = useRef(null)
  const lastRegionRef = useRef(null)

  const fetchPins = useCallback(
    (region) => {
      lastRegionRef.current = region
      const bounds = regionToBounds(region)
      setBounds(bounds)
      // Every active filter travels to the server (schema-driven, mirrors web)
      propertyService
        .getPinsInBounds(bounds, toQueryParams(filters))
        .then((r) => setPins(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    },
    [filters, setBounds, setPins]
  )

  const onRegionChangeComplete = useCallback(
    (region) => {
      setRegion(region)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchPins(region), DEBOUNCE_MS)
    },
    [fetchPins, setRegion]
  )

  // Filter changes refetch immediately against the last known viewport,
  // mirroring web's behavior instead of waiting for the next pan/zoom.
  // Keyed on the serialized query params, which deliberately exclude
  // `filters.area` (it's search context, not a wire param — see
  // config/filters.js): a location search always follows with MapView's
  // flyTo() moving the map, which refetches pins for the new viewport
  // itself. Refetching here too would race against that one using the
  // stale pre-fly viewport, and could resolve after it and overwrite the
  // correct pins with wrong-location ones.
  const paramsKey = JSON.stringify(toQueryParams(filters))
  useEffect(() => {
    if (lastRegionRef.current) fetchPins(lastRegionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  // Initial fetch on mount — MapView's onMapReady triggers a non-animated
  // fitToCoordinates() to frame all cities, and on Android that programmatic
  // move does not reliably fire onRegionChangeComplete. Without this, pins
  // never load until the user manually pans/zooms the map.
  useEffect(() => {
    if (!lastRegionRef.current) fetchPins(useMapStore.getState().region)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  return { onRegionChangeComplete, fetchPinsNow: fetchPins }
}
