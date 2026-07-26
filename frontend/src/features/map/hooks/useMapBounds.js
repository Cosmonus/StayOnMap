import { useEffect } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { propertyService } from '@services/property.service'
import { toQueryParams } from '@/config/filters'

export function useMapBounds(mapRef) {
  const setPins        = useMapStore((s) => s.setPins)
  const setBounds      = useMapStore((s) => s.setBounds)
  const setViewport    = useMapStore((s) => s.setViewport)
  const setRefetchPins = useMapStore((s) => s.setRefetchPins)
  const mapReady       = useMapStore((s) => s.flyTo !== null)
  const filters        = useFilterStore((s) => s.filters)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let debounceTimer = null
    let pollTimer     = null
    let done          = false

    // Bounds and zoom always follow the viewport — useMapPins needs them to
    // cluster, and the "homes in this view" count would go stale without them.
    // Only the network call is gated by searchOnMove.
    function syncViewport() {
      const b = map.getBounds()
      if (!b || typeof b.getSouthWest !== 'function') return null

      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      setBounds({ swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() })
      setViewport(map.getCenter()?.toJSON() ?? {}, map.getZoom() ?? 5)
      return b
    }

    function fetchPins() {
      const b = syncViewport()
      if (!b) return

      // Every active filter travels to the server — the pin set is always
      // server-filtered, the viewport never moves because of a filter change.
      propertyService.getPinsInBounds(b, toQueryParams(filters))
        .then((r) => setPins(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    }

    function onIdle() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        // Read at fire time, not from a dep — toggling the checkbox must not
        // tear down the idle listener and refetch as a side effect.
        if (useMapStore.getState().searchOnMove) fetchPins()
        else syncViewport()
      }, 400)
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

    // The first fetch always runs regardless of searchOnMove — the map must
    // never open empty. Expose it so "Search this area" can fetch on demand.
    setRefetchPins(() => fetchPins)

    const idleListener = window.google.maps.event.addListener(map, 'idle', onIdle)

    return () => {
      clearTimeout(debounceTimer)
      clearTimeout(pollTimer)
      done = true
      window.google.maps.event.removeListener(idleListener)
      setRefetchPins(null)
    }
  }, [mapRef, mapReady, filters, setPins, setBounds, setViewport, setRefetchPins])
}
