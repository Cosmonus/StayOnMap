import { useEffect, useRef } from 'react'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { useMapPins } from '../hooks/useMapPins'
import { useMapBounds } from '../hooks/useMapBounds'
import { useMapLayers } from '../hooks/useMapLayers'
import MapControls from './MapControls'
// import { useAreaLabels } from '../hooks/useAreaLabels'  // TODO: re-enable after area research
import { CITIES } from '@/config/cities'

const CITY_ZOOM = 12
const AREA_ZOOM = 15

export default function MapView({ contained = false }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const searchMarker = useRef(null)

  useMapPins(mapRef)
  useMapBounds(mapRef)
  useMapLayers(mapRef)
  // useAreaLabels(mapRef)  // TODO: re-enable after area research

  const city          = useFilterStore((s) => s.filters.city)
  const area          = useFilterStore((s) => s.filters.area)
  const searchedPlace = useMapStore((s) => s.searchedPlace)
  const mapReady      = useMapStore((s) => s.flyTo !== null)
  const pins          = useMapStore((s) => s.pins)

  // Init map once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    googleMapsReady.then(() => {
      if (cancelled || mapRef.current) return

      // A vector Map ID (created in Google Cloud Console) switches Google's
      // basemap to GPU/WebGL rendering — smoother pan/zoom and a prerequisite
      // for any WebGL overlay. Opt-in: unset env → undefined → current raster
      // behavior, so this is a no-op until VITE_GOOGLE_MAPS_MAP_ID is provided.
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined

      const map = new window.google.maps.Map(el, {
        center:            { lat: 14.5, lng: 78.9629 },
        zoom:              6,
        mapId,
        mapTypeId:         'terrain',
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        gestureHandling: 'greedy',
      })

      mapRef.current = map

      // Fit viewport to the 3 supported cities
      const bounds = new window.google.maps.LatLngBounds()
      CITIES.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }))
      map.fitBounds(bounds, 80)

      useMapStore.getState().setFlyTo((opts) => {
        if (!mapRef.current) return
        const [lng, lat] = opts.center
        mapRef.current.setZoom(opts.zoom ?? mapRef.current.getZoom())
        mapRef.current.panTo({ lat, lng })
      })
    })

    return () => {
      cancelled = true
      mapRef.current = null
      useMapStore.getState().setFlyTo(null)
    }
  }, [])

  // Fly to city
  useEffect(() => {
    const map = mapRef.current
    if (!map || !city || area) return
    const cityData = CITIES.find((c) => c.name === city)
    if (!cityData) return
    map.setZoom(CITY_ZOOM)
    map.panTo({ lat: cityData.lat, lng: cityData.lng })
  }, [city, area, mapReady])

  // Geocode area and fly
  useEffect(() => {
    const map = mapRef.current
    if (!map || !area) return
    googleMapsReady.then(() => {
      const geocoder = new window.google.maps.Geocoder()
      const cityData  = CITIES.find((c) => c.name === city)
      const address   = cityData ? `${area}, ${cityData.name}, India` : `${area}, India`
      geocoder.geocode({ address, region: 'in' }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) return
        const loc = results[0].geometry.location
        map.setZoom(AREA_ZOOM)
        map.panTo({ lat: loc.lat(), lng: loc.lng() })
      })
    })
  }, [area, city, mapReady])

  // Orange pin at searched place
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    searchMarker.current?.remove()
    searchMarker.current = null
    if (!searchedPlace || pins.length === 0) return

    const el = document.createElement('div')
    el.style.filter = 'drop-shadow(0 3px 6px rgba(244,81,30,0.55))'
    el.innerHTML = `
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#f4511e"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    `

    searchMarker.current = createHtmlMarker({
      element: el,
      lat: searchedPlace.lat,
      lng: searchedPlace.lng,
      map,
    })
  }, [searchedPlace, pins])

  return (
    <div style={contained
      ? { position: 'absolute', inset: 0, zIndex: 0 }
      : { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }
    }>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Layer toggles */}
      {mapReady && <MapControls />}
    </div>
  )
}
