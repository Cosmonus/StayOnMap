import { useCallback, useEffect, useRef } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { propertyService } from '@services/property.service'
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
      propertyService
        .getPinsInBounds(bounds, {
          bhk: filters.bhk?.length ? filters.bhk.join(',') : undefined,
          furnished: filters.furnished || undefined,
          city: filters.city || undefined,
        })
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
  // Deliberately excludes `filters.area` — area is never sent to the pins
  // query (only bhk/furnished/city are, see property.service.js), and a
  // location search always follows with MapView's flyTo() moving the map,
  // which refetches pins for the new viewport itself (see MapView.js).
  // Refetching here too would race against that one using the stale
  // pre-fly viewport, and could resolve after it and overwrite the correct
  // pins with wrong-location ones.
  useEffect(() => {
    if (lastRegionRef.current) fetchPins(lastRegionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.bhk, filters.furnished, filters.city])

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
