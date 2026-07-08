import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'
import { useAuth } from '@features/auth/hooks/useAuth'

// Dark ink dot — matches the app's #111111 accent (CTAs, active filter chips)
// instead of Google's location blue, which would fight the color-filled
// property pins for attention.
const DOT_COLOR = '#111111'

function makeLocationEl() {
  const el = document.createElement('div')
  el.setAttribute('aria-label', 'Your current location')
  // 0x0 anchor so createHtmlMarker centers it exactly on the coordinate;
  // children position themselves around the point via negative offsets
  // (transform-based centering would fight animate-ping's scale transform).
  el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none'
  el.innerHTML = `
    <span class="animate-ping" style="position:absolute;left:-12px;top:-12px;width:24px;height:24px;border-radius:9999px;background:${DOT_COLOR};opacity:0.25"></span>
    <span style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:9999px;background:${DOT_COLOR};box-shadow:0 1px 4px rgba(0,0,0,0.35)"></span>
  `
  return el
}

// Shows a pulsing dark dot at the logged-in user's current position.
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
