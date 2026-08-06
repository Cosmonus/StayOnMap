import { useEffect, useRef } from 'react'
import { googleMapsReady, createHtmlMarker, resolvePlace } from '@lib/googleMaps'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { useMapPins } from '../hooks/useMapPins'
import { useMapBounds } from '../hooks/useMapBounds'
import { useMapLayers } from '../hooks/useMapLayers'
import { useUserLocation } from '../hooks/useUserLocation'
import MapControls from './MapControls'
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
  useUserLocation(mapRef)

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
        mapTypeId:         'roadmap',
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        // Contained (homepage hero): 'cooperative' so a one-finger swipe
        // scrolls the PAGE, not the map — 'greedy' there traps mobile users
        // inside a 60vh map with no way to scroll past it. Full-screen map
        // surfaces keep 'greedy' (required for one-finger pan).
        gestureHandling: contained ? 'cooperative' : 'greedy',
        // Google's own POI pins stay decorative. Clicking near one used to open
        // GOOGLE's info window over our map — a card for a temple or a
        // restaurant, complete with a link OUT to Google Maps — which competes
        // with the property pins that are the point of the surface and hands
        // the visitor to another product mid-search. Same setting the property
        // detail map already uses.
        clickableIcons: false,
      })

      mapRef.current = map

      // Fit viewport to the 3 supported cities
      const bounds = new window.google.maps.LatLngBounds()
      CITIES.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }))
      map.fitBounds(bounds, 80)

      useMapStore.getState().setFlyTo((opts) => {
        if (!mapRef.current) return
        // A place's own extent beats any fixed zoom: "Delhi" frames the whole
        // city, a street frames the street. Zoom+pan stays the fallback.
        if (opts.bounds) {
          const { swLat, swLng, neLat, neLng } = opts.bounds
          mapRef.current.fitBounds(
            new window.google.maps.LatLngBounds({ lat: swLat, lng: swLng }, { lat: neLat, lng: neLng }),
            40
          )
          return
        }
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
  }, [contained])

  // Fly to city
  useEffect(() => {
    const map = mapRef.current
    if (!map || !city || area) return
    const cityData = CITIES.find((c) => c.name === city)
    if (!cityData) return
    map.setZoom(CITY_ZOOM)
    map.panTo({ lat: cityData.lat, lng: cityData.lng })
  }, [city, area, mapReady])

  // Resolve area text and fly (Places-first with Geocoder fallback —
  // Geocoder alone silently no-ops when the key lacks the Geocoding API)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !area) return
    let cancelled = false
    resolvePlace(area, city).then((place) => {
      if (cancelled || !place || !mapRef.current) return
      // A place's own extent beats a fixed zoom — same rule flyTo follows.
      // Forcing AREA_ZOOM on a city dropped the camera into the city centre
      // at street zoom, which shows a handful of pins and reads as "it went
      // somewhere odd" rather than "it framed Bengaluru".
      if (place.viewport) {
        const { swLat, swLng, neLat, neLng } = place.viewport
        mapRef.current.fitBounds(
          new window.google.maps.LatLngBounds({ lat: swLat, lng: swLng }, { lat: neLat, lng: neLng }),
          40
        )
        return
      }
      mapRef.current.setZoom(AREA_ZOOM)
      mapRef.current.panTo({ lat: place.lat, lng: place.lng })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [area, city, mapReady])

  // Orange pin at searched place
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    searchMarker.current?.remove()
    searchMarker.current = null
    if (!searchedPlace || pins.length === 0) return

    const el = document.createElement('div')
    el.style.filter = 'drop-shadow(0 3px 6px rgba(28,26,22,0.45))'
    el.innerHTML = `
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#1c1a16"/>
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
