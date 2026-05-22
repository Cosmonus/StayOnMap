import { useEffect, useRef } from 'react'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import { CITIES } from '@/config/cities'

export default function MapPreview() {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    googleMapsReady.then(() => {
      if (cancelled) return

      const map = new window.google.maps.Map(el, {
        mapTypeId:          'terrain',
        disableDefaultUI:   true,
        gestureHandling:    'none',
        zoomControl:        false,
        keyboardShortcuts:  false,
        styles: PREVIEW_STYLES,
      })

      // Fit all cities into view
      const bounds = new window.google.maps.LatLngBounds()
      CITIES.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }))
      map.fitBounds(bounds, 100)

      // City label pills
      CITIES.forEach(({ name, lat, lng, listingCount }) => {
        const pill = document.createElement('div')
        pill.style.cssText = `
          background: white;
          border-radius: 999px;
          padding: 5px 12px 5px 5px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.13);
          border: 1.5px solid #f1f5f9;
          font-family: Inter, sans-serif;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 8px;
        `
        pill.innerHTML = `
          <div style="width:30px;height:30px;background:#f4511e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:800;color:white;letter-spacing:-0.02em;">
            ${name.charAt(0)}
          </div>
          <div>
            <div style="font-size:10px;font-weight:600;color:#64748b;line-height:1;">${name}</div>
            <div style="font-size:13px;font-weight:800;color:#111111;line-height:1.4;">${listingCount} <span style="font-size:10px;font-weight:500;color:#f4511e;">prop.</span></div>
          </div>
        `
        createHtmlMarker({ element: pill, lat, lng, map })
      })
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="relative w-full h-96 sm:h-[480px] md:h-[680px]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Fade-to-white vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, white 0%, transparent 25%)' }}
      />

      {/* Total badge */}
      <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 z-10 pointer-events-none">
        <div className="bg-[#111111] text-white rounded-xl px-4 py-2.5 shadow-lg flex flex-wrap items-center gap-x-4 gap-y-1 max-w-[calc(100vw-1.5rem)]">
          <span className="text-xs text-slate-400 font-medium">Total across all cities</span>
          <span className="text-sm font-bold text-brand-400">6,000+ rentals</span>
        </div>
      </div>
    </div>
  )
}

const PREVIEW_STYLES = [
  { elementType: 'geometry',           stylers: [{ color: '#f8f9fa' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#555f6e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',               elementType: 'geometry',        stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',               elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'water',              elementType: 'geometry',        stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'poi.park',           elementType: 'geometry',        stylers: [{ color: '#d1fae5' }] },
  { featureType: 'landscape',          elementType: 'geometry',        stylers: [{ color: '#f8f9fa' }] },
]
