import { useEffect, useRef, useState } from 'react'
import { googleMapsReady } from '@lib/googleMaps'
import AreaInput from '@features/search/components/AreaInput'

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

// The search is AreaInput — the same Places-autocomplete control the map and
// admin already use. It replaced a bare input wired to `google.maps.Geocoder`,
// which never worked here: the browser key is restricted to Maps JavaScript +
// Places (see docs/google-maps-api-setup.md), so every geocode came back
// REQUEST_DENIED and the "Find" button silently did nothing.
export default function LocationPicker({ value, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    googleMapsReady.then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const center = value ? { lat: value.lat, lng: value.lng } : INDIA_CENTER
      const zoom = value ? 14 : 5

      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
        // A POI info window opening here would swallow the click that is
        // supposed to place the pin.
        clickableIcons: false,
      })
      mapRef.current = map

      const marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: 'Drag to exact location',
      })
      markerRef.current = marker

      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        onChange({ lat: pos.lat(), lng: pos.lng() })
      })

      map.addListener('click', (e) => {
        marker.setPosition(e.latLng)
        onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      })
    })

    return () => {
      cancelled = true
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the place's own extent — a city shows the whole city, a street its
  // block — and let the owner zoom in from there. A fixed setZoom(16) dropped
  // a "Bengaluru" search onto one arbitrary street of it.
  function placePicked({ lat, lng, viewport }) {
    if (!mapRef.current) return
    markerRef.current?.setPosition({ lat, lng })
    onChange({ lat, lng })
    if (viewport) {
      mapRef.current.fitBounds(new window.google.maps.LatLngBounds(
        { lat: viewport.swLat, lng: viewport.swLng },
        { lat: viewport.neLat, lng: viewport.neLng },
      ))
    } else {
      mapRef.current.setZoom(16)
      mapRef.current.panTo({ lat, lng })
    }
  }

  return (
    <div className="space-y-2">
      <AreaInput
        value={query}
        onChange={setQuery}
        onPlacePicked={placePicked}
        onClear={() => {}}
        showLabel={false}
      />

      <div ref={containerRef} className="w-full h-80 rounded-lg overflow-hidden border border-slate-200" />

      <p className="text-xs text-slate-500">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the marker to fine-tune`
          : 'Search your area then click the map or drag the marker to set the exact location'}
      </p>
    </div>
  )
}
