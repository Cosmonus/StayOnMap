import { useEffect, useRef, useState } from 'react'
import { googleMapsReady } from '@lib/googleMaps'

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

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
        fullscreenControl: false,
        gestureHandling: 'greedy',
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

  function search() {
    if (!query.trim() || !mapRef.current) return
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: `${query}, India`, region: 'in' }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) return
      const loc = results[0].geometry.location
      mapRef.current.setZoom(15)
      mapRef.current.panTo(loc)
      markerRef.current?.setPosition(loc)
      onChange({ lat: loc.lat(), lng: loc.lng() })
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search area, e.g. Koramangala, Bengaluru"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={search}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          Find
        </button>
      </div>

      <div ref={containerRef} className="w-full h-52 rounded-lg overflow-hidden border border-slate-200" />

      <p className="text-xs text-slate-500">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the marker to fine-tune`
          : 'Search your area then click the map or drag the marker to set the exact location'}
      </p>
    </div>
  )
}
