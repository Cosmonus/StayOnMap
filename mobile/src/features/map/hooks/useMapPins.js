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
  useEffect(() => {
    if (lastRegionRef.current) fetchPins(lastRegionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  return { onRegionChangeComplete, fetchPinsNow: fetchPins }
}
