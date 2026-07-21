import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'

const MIN_ZOOM       = 13
const RADIUS_M       = 800
const DEBOUNCE_MS    = 700
const MOVE_THRESHOLD = 0.4

const TYPE_ICON = {
  supermarket:            '🛒',
  grocery_or_supermarket: '🛒',
  convenience_store:      '🛒',
  hospital:               '🏥',
  doctor:                 '🏥',
  school:                 '🏫',
  university:             '🎓',
  transit_station:        '🚉',
  subway_station:         '🚇',
  bus_station:            '🚌',
  restaurant:             '🍽️',
  cafe:                   '☕',
  bank:                   '🏦',
  atm:                    '💳',
  pharmacy:               '💊',
  shopping_mall:          '🏬',
  park:                   '🌳',
}

const RELEVANT = new Set(Object.keys(TYPE_ICON))

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, d2r = Math.PI / 180
  const dLat = (lat2 - lat1) * d2r
  const dLng = (lng2 - lng1) * d2r
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function makeLandmarkEl(place) {
  const icon = place.types?.map(t => TYPE_ICON[t]).find(Boolean) ?? '📍'

  const wrap = document.createElement('div')
  wrap.title = place.name
  Object.assign(wrap.style, {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', transition: 'transform 150ms ease',
  })

  const dot = document.createElement('div')
  Object.assign(dot.style, {
    width: '30px', height: '30px', borderRadius: '50%',
    background: 'white', border: '1.5px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  })
  dot.textContent = icon

  const lbl = document.createElement('div')
  Object.assign(lbl.style, {
    marginTop: '2px', padding: '1px 6px',
    background: 'white', borderRadius: '4px',
    fontSize: '9px', fontWeight: '600', color: '#334155',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    maxWidth: '80px', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  })
  lbl.textContent = place.name

  wrap.appendChild(dot)
  wrap.appendChild(lbl)
  wrap.addEventListener('mouseenter', () => { wrap.style.transform = 'scale(1.15)' })
  wrap.addEventListener('mouseleave', () => { wrap.style.transform = 'scale(1)' })

  return wrap
}

export function useLandmarks(mapRef) {
  const markersRef = useRef([])
  const lastRef    = useRef(null)
  const timerRef   = useRef(null)
  const mapReady   = useMapStore((s) => s.flyTo !== null)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function clearMarkers() {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }

    function fetchLandmarks(lat, lng) {
      if (!window.google?.maps?.places) return
      const svc = new window.google.maps.places.PlacesService(document.createElement('div'))
      svc.nearbySearch({ location: { lat, lng }, radius: RADIUS_M }, (results, status) => {
        if (status !== 'OK' || !results) return
        clearMarkers()
        results
          .filter(p => p.geometry?.location && p.types?.some(t => RELEVANT.has(t)))
          .forEach(place => {
            const placeLat = place.geometry.location.lat()
            const placeLng = place.geometry.location.lng()
            const el = makeLandmarkEl(place)

            el.addEventListener('click', () => {
              useFilterStore.getState().setFilters({ area: place.name })
              useMapStore.getState().setSearchedPlace({ name: place.name, lat: placeLat, lng: placeLng })
            })

            const marker = createHtmlMarker({ element: el, lat: placeLat, lng: placeLng, map })
            markersRef.current.push(marker)
          })
      })
    }

    function onIdle() {
      const zoom = map.getZoom()
      if (zoom < MIN_ZOOM) return

      const center = map.getCenter()
      const lat = center.lat()
      const lng = center.lng()

      if (lastRef.current) {
        const moved = haversine(lat, lng, lastRef.current.lat, lastRef.current.lng)
        if (moved < MOVE_THRESHOLD) return
      }

      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        lastRef.current = { lat, lng }
        fetchLandmarks(lat, lng)
      }, DEBOUNCE_MS)
    }

    const listener = window.google.maps.event.addListener(map, 'idle', onIdle)

    return () => {
      window.google.maps.event.removeListener(listener)
      clearTimeout(timerRef.current)
      clearMarkers()
    }
  }, [mapRef, mapReady])
}
