import { useEffect, useRef } from 'react'
import mapboxgl from '@lib/mapbox'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from '../utils/mapbox.config'
import { useMapStore } from '@store/mapStore'

export function useMap() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })

    mapRef.current.addControl(new mapboxgl.AttributionControl(), 'bottom-left')
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    useMapStore.getState().setFlyTo((opts) => mapRef.current?.flyTo(opts))

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      useMapStore.getState().setFlyTo(null)
    }
  }, [])

  return { containerRef, mapRef }
}
