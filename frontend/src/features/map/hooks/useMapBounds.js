import { useEffect } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { propertyService } from '@services/property.service'
import { toQueryParams } from '@/config/filters'

export function useMapBounds(mapRef) {
  const setPins     = useMapStore((s) => s.setPins)
  const setBounds   = useMapStore((s) => s.setBounds)
  const setViewport = useMapStore((s) => s.setViewport)
  const mapReady    = useMapStore((s) => s.flyTo !== null)
  const filters     = useFilterStore((s) => s.filters)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let debounceTimer = null
    let pollTimer     = null
    let done          = false

    function fetchPins() {
      const b = map.getBounds()
      if (!b || typeof b.getSouthWest !== 'function') return

      // Keep zoom + bounds in the store so useMapPins can cluster
      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      setBounds({ swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() })
      setViewport(map.getCenter()?.toJSON() ?? {}, map.getZoom() ?? 5)

      // Every active filter travels to the server — the pin set is always
      // server-filtered, the viewport never moves because of a filter change.
      propertyService.getPinsInBounds(b, toQueryParams(filters))
        .then((r) => setPins(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    }

    function onIdle() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(fetchPins, 400)
    }

    // Poll until Google Maps has valid bounds, then do the first fetch.
    function pollUntilBounds() {
      if (done) return
      const b = map.getBounds()
      if (b && typeof b.getSouthWest === 'function') {
        done = true
        fetchPins()
      } else {
        pollTimer = setTimeout(pollUntilBounds, 100)
      }
    }
    pollUntilBounds()

    const idleListener = window.google.maps.event.addListener(map, 'idle', onIdle)

    return () => {
      clearTimeout(debounceTimer)
      clearTimeout(pollTimer)
      done = true
      window.google.maps.event.removeListener(idleListener)
    }
  }, [mapRef, mapReady, filters, setPins, setBounds, setViewport])
}
