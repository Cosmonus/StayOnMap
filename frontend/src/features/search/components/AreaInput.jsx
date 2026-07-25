import { useState, useEffect, useRef } from 'react'
import { MapPin, Search, X, Clock } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { CITIES } from '@/config/cities'
import { googleMapsReady, resolvePlace, viewportOf } from '@lib/googleMaps'

function useAreaSuggestions(query, cityName) {
  const [suggestions, setSuggestions] = useState([])
  const svcRef   = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    googleMapsReady
      .then(() => { svcRef.current = new window.google.maps.places.AutocompleteService() })
      .catch(() => {})
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query || query.length < 2) { setSuggestions([]); return }

    timerRef.current = setTimeout(() => {
      if (!svcRef.current) { setSuggestions([]); return }

      const city = CITIES.find((c) => c.name === cityName)
      const input = city ? `${query}, ${city.name}, India` : `${query}, India`

      svcRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'in' },
          types: ['geocode', 'establishment'],
          ...(city && {
            locationBias: {
              center: { lat: city.lat, lng: city.lng },
              radius: 30000,
            },
          }),
        },
        (results, status) => {
          if (status === 'OK' && results) setSuggestions(results)
          else setSuggestions([])
        }
      )
    }, 300)

    return () => clearTimeout(timerRef.current)
  }, [query, cityName])

  return suggestions
}

const RECENT_KEY = 'sn_recent_areas'

function getRecentAreas() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecentArea(label) {
  if (!label?.trim()) return
  const prev = getRecentAreas()
  const next = [label, ...prev.filter((r) => r !== label)].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

/**
 * Area / landmark input with Google Places autocomplete.
 *
 * Props:
 *   value        – controlled value (string)
 *   city         – currently selected city name (for biased suggestions)
 *   onChange     – called with new string on every keystroke and on pick
 *   onPlacePicked – ({ name, lat, lng }) called when user picks a suggestion.
 *                   When omitted, falls back to flying the shared user mapStore.
 *   onClear      – called when user clears the input (no args).
 *                   When omitted, clears the user mapStore searchedPlace.
 *   bare         – when true, renders without its own border/background —
 *                  for embedding flush inside another control (e.g. a search pill)
 *                  instead of as a standalone form field.
 */
export default function AreaInput({ value, city, onChange, onPlacePicked, onClear, showLabel = true, bare = false }) {
  const [query, setQuery]     = useState(value)
  const [open, setOpen]       = useState(false)
  const [recents, setRecents] = useState([])
  const wrapRef               = useRef(null)
  const queryRef              = useRef(value ?? '')
  const suppressRef           = useRef(false)
  const suggestions           = useAreaSuggestions(query, city)

  useEffect(() => {
    if (value === queryRef.current) return
    queryRef.current = value ?? ''
    setQuery(value ?? '')
    setOpen(false)
  }, [value])

  useEffect(() => {
    if (suppressRef.current) { suppressRef.current = false; return }
    setOpen(suggestions.length > 0)
  }, [suggestions])

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleType(e) {
    const val = e.target.value
    queryRef.current = val
    setQuery(val)
    onChange(val)
  }

  function pick(feature) {
    const label = feature.structured_formatting?.main_text || feature.description?.split(',')[0] || feature.text || ''
    queryRef.current  = label
    suppressRef.current = true
    setQuery(label)
    setOpen(false)
    onChange(label)
    saveRecentArea(label)

    if (!feature.place_id || !window.google?.maps?.places) return

    const svc = new window.google.maps.places.PlacesService(document.createElement('div'))
    svc.getDetails({ placeId: feature.place_id, fields: ['geometry'] }, (place, status) => {
      if (status !== 'OK' || !place?.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const viewport = viewportOf(place.geometry)
      useMapStore.getState().clearSelection()
      if (onPlacePicked) {
        onPlacePicked({ name: label, lat, lng, viewport })
      } else {
        useMapStore.getState().flyTo?.({ center: [lng, lat], zoom: 16, bounds: viewport ?? undefined, duration: 800 })
        useMapStore.getState().setSearchedPlace({ name: label, lat, lng })
      }
    })
  }

  async function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    if (suggestions.length > 0) {
      pick(suggestions[0])
      return
    }

    // No autocomplete suggestion yet — resolve the typed text directly
    // (Places-first with Geocoder fallback, see lib/googleMaps.js)
    if (!query.trim()) return
    const place = await resolvePlace(query, city).catch(() => null)
    if (!place) return

    setOpen(false)
    saveRecentArea(place.name)
    useMapStore.getState().clearSelection()
    if (onPlacePicked) {
      onPlacePicked(place)
    } else {
      useMapStore.getState().flyTo?.({ center: [place.lng, place.lat], zoom: 16, bounds: place.viewport ?? undefined, duration: 800 })
      useMapStore.getState().setSearchedPlace(place)
    }
  }

  function clear() {
    queryRef.current    = ''
    suppressRef.current = true
    setQuery('')
    setOpen(false)
    onChange('')
    if (onClear) {
      onClear()
    } else {
      useMapStore.getState().setSearchedPlace(null)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {showLabel && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Area or landmark
        </label>
      )}
      <div className={bare
        ? 'flex items-center gap-2 px-2 py-1'
        : 'flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus-within:border-[#111111] focus-within:ring-2 focus-within:ring-black/8 transition overflow-hidden'
      }>
        <Search size={13} stroke="#94a3b8" strokeWidth={2} className="shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleType}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const r = getRecentAreas()
            setRecents(r)
            if (suggestions.length) setOpen(true)
            else if (!query && r.length) setOpen(true)
          }}
          placeholder={city ? `Search in ${city}…` : 'Search city, area or landmark…'}
          className="flex-1 min-w-0 text-sm text-slate-700 placeholder-slate-400 bg-transparent outline-none"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); clear() }}
            aria-label="Clear search"
            className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            <X size={8} stroke="#64748b" strokeWidth={3} />
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || (!query && recents.length > 0)) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50">
          {!query && recents.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Recent</p>
              {recents.map((label) => (
                <button
                  key={label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    queryRef.current = label
                    suppressRef.current = true
                    setQuery(label)
                    setOpen(false)
                    onChange(label)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <Clock size={13} stroke="#94a3b8" strokeWidth={2} className="shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700 truncate">{label}</p>
                </button>
              ))}
              {suggestions.length > 0 && <div className="border-t border-slate-100 mt-1" />}
            </>
          )}
          {suggestions.map((feature) => {
            const name    = feature.structured_formatting?.main_text || feature.description?.split(',')[0] || feature.text || ''
            const context = feature.structured_formatting?.secondary_text || feature.description?.split(',').slice(1, 3).join(',').trim() || ''
            return (
              <button
                key={feature.place_id || feature.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(feature) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
              >
                <MapPin size={13} fill="#f4511e" stroke="none" className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                  {context && <p className="text-xs text-slate-500 truncate">{context}</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
