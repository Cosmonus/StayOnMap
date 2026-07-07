import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'
import { useAuth } from '@features/auth/hooks/useAuth'

// Google-style location blue — deliberate, matches the universal "you are here"
// convention rather than the brand palette (same exception as the orange search pin).
const DOT_BLUE = '#4285F4'

function makeLocationEl() {
  const el = document.createElement('div')
  el.setAttribute('aria-label', 'Your current location')
  // 0x0 anchor so createHtmlMarker centers it exactly on the coordinate;
  // children position themselves around the point via negative offsets
  // (transform-based centering would fight animate-ping's scale transform).
  el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none'
  el.innerHTML = `
    <span class="animate-ping" style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:9999px;background:${DOT_BLUE};opacity:0.35"></span>
    <span style="position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:9999px;background:${DOT_BLUE};border:3px solid white;box-shadow:0 1px 6px rgba(66,133,244,0.6)"></span>
  `
  return el
}

// Shows a blue glowing dot at the logged-in user's current position.
// Guests never trigger the browser's location permission prompt.
export function useUserLocation(mapRef) {
  const { user } = useAuth()
  const isLoggedIn = !!user
  const mapReady = useMapStore((s) => s.flyTo !== null)
  const markerRef = useRef(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !isLoggedIn || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        markerRef.current?.remove()
        markerRef.current = createHtmlMarker({
          element: makeLocationEl(),
          lat: coords.latitude,
          lng: coords.longitude,
          map,
        })
      },
      () => {}, // permission denied / unavailable — simply no dot
      { enableHighAccuracy: true, maximumAge: 60_000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [mapRef, mapReady, isLoggedIn])
}
