import { useEffect } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { propertyService } from '@services/property.service'

export function useMapBounds(mapRef) {
  const setPins  = useMapStore((s) => s.setPins)
  const mapReady = useMapStore((s) => s.flyTo !== null)
  const filters  = useFilterStore((s) => s.filters)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let debounceTimer = null
    let pollTimer     = null
    let done          = false   // prevents double-fetch once bounds arrive

    function fetchPins() {
      const bounds = map.getBounds()
      if (!bounds || typeof bounds.getSouthWest !== 'function') return
      propertyService.getPinsInBounds(bounds, {
        bhk:       filters.bhk?.length ? filters.bhk.join(',') : undefined,
        furnished: filters.furnished || undefined,
        city:      filters.city      || undefined,
      })
        .then(r => setPins(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    }

    function onIdle() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(fetchPins, 400)
    }

    // Poll every 100ms until the map has valid bounds, then do the first fetch.
    // This is more reliable than relying on 'idle' or 'tilesloaded' events
    // which may have already fired before this effect registers listeners.
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

    // Keep the idle listener so panning/zooming reloads pins
    const idleListener = window.google.maps.event.addListener(map, 'idle', onIdle)

    return () => {
      clearTimeout(debounceTimer)
      clearTimeout(pollTimer)
      done = true
      window.google.maps.event.removeListener(idleListener)
    }
  }, [mapRef, mapReady, filters, setPins])
}
