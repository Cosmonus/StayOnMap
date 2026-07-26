import { useEffect, useRef } from 'react'
import { Plus, Minus, LocateFixed } from 'lucide-react'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'

// ── Location map card ────────────────────────────────────────────────────────
// Interactive, property-detail only: drag to pan, custom zoom buttons, and a
// locate button that snaps back to the house. `cooperative` rather than
// `greedy` because this map sits in the middle of a scrollable page — greedy
// would hijack the page scroll the moment the cursor crosses it (the fullscreen
// explore map wants greedy; an embedded card does not).
const LOCATION_MAP_ZOOM = 15

// House pin: teardrop in brand-600 with the lucide "house" line icon knocked
// out in white. Same construction as the searched-place pin in .claude/maps.md
// (inline SVG + drop-shadow, hex allowed by the map-overlay exception —
// #0d8a5f IS brand-600). createHtmlMarker translates (-50%,-100%), so the
// teardrop's tip sits exactly on the coordinate.
function housePinElement() {
  const el = document.createElement('div')
  el.style.filter = 'drop-shadow(0 3px 6px rgba(13,138,95,0.45))'
  el.innerHTML = `
    <svg width="40" height="52" viewBox="0 0 32 42" fill="none" aria-hidden="true">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#0d8a5f"/>
      <g transform="translate(9.5 9.5) scale(0.542)" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      </g>
    </svg>`
  return el
}

function MapControlButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {children}
    </button>
  )
}

export default function PropertyLocationMap({ lat, lng }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!lat || !lng || !containerRef.current) return
    let marker = null
    let cancelled = false

    googleMapsReady.then(() => {
      if (cancelled || !containerRef.current) return
      const center = { lat: Number(lat), lng: Number(lng) }
      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: LOCATION_MAP_ZOOM,
        mapTypeId: 'roadmap',
        disableDefaultUI: true, // our own controls below — Google's don't match the theme
        gestureHandling: 'cooperative',
        clickableIcons: false,
      })
      mapRef.current = map
      marker = createHtmlMarker({ element: housePinElement(), lat: center.lat, lng: center.lng, map })
    })

    return () => { cancelled = true; marker?.remove(); mapRef.current = null }
  }, [lat, lng])

  // Guarded, not disabled-looking: before init these are no-ops for the
  // fraction of a second the maps script takes to arrive.
  const zoomBy = (delta) => {
    const map = mapRef.current
    if (map) map.setZoom(map.getZoom() + delta)
  }
  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    map.panTo({ lat: Number(lat), lng: Number(lng) })
    map.setZoom(LOCATION_MAP_ZOOM)
  }

  return (
    <div className="relative">
      {/* Taller now that the map is interactive — 240px was fine for a static
          thumbnail, but panning and zooming need room to be worth doing. */}
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl bg-slate-100 md:h-96" />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <MapControlButton label="Zoom in" onClick={() => zoomBy(1)}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
        <MapControlButton label="Zoom out" onClick={() => zoomBy(-1)}>
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
        <MapControlButton label="Back to the property" onClick={recenter}>
          <LocateFixed className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
      </div>
    </div>
  )
}
