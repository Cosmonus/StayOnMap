import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useMapStore } from '@store/mapStore'

const SCRIPT_ID  = 'gm-places-script'
const CB_NAME    = '__gmPlacesReady'

function loadGooglePlaces(apiKey) {
  if (window.google?.maps?.places) return Promise.resolve()

  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      const prev = window[CB_NAME]
      window[CB_NAME] = () => { prev?.(); resolve() }
      return
    }

    window[CB_NAME] = resolve

    const s = document.createElement('script')
    s.id  = SCRIPT_ID
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${CB_NAME}`
    s.async   = true
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function SearchBar() {
  const inputRef = useRef(null)
  const [ready, setReady] = useState(!!window.google?.maps?.places)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!apiKey || ready) return
    loadGooglePlaces(apiKey)
      .then(() => setReady(true))
      .catch(() => console.error('[SearchBar] Google Maps failed to load'))
  }, [apiKey, ready])

  useEffect(() => {
    if (!ready || !inputRef.current) return

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry', 'name'],
    })

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      useMapStore.getState().flyTo?.({
        center: [place.geometry.location.lng(), place.geometry.location.lat()],
        zoom: 15,
        duration: 1200,
      })
    })

    return () => window.google.maps.event.removeListener(listener)
  }, [ready])

  if (!apiKey) return null

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-float border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all duration-150">
        <Search size={15} stroke="#94a3b8" strokeWidth={2.5} className="shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search city, area or landmark…"
          className="flex-1 min-w-0 text-sm text-slate-700 placeholder-slate-400 bg-transparent outline-none"
        />
      </div>
    </div>
  )
}
