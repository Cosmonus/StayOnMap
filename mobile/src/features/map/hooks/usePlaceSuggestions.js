import { useEffect, useRef, useState } from 'react'
import { autocompletePlaces } from '@lib/googlePlaces'
import { CITIES } from '@config/cities'

// Mirrors frontend/src/features/search/components/AreaInput.jsx's
// useAreaSuggestions, adapted to the REST Places API (no browser JS SDK on RN).
// Takes `cityName` (not a city object) so the effect below can depend on a
// stable primitive instead of a freshly-constructed object reference.
export function usePlaceSuggestions(query, cityName) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query || query.trim().length < 2) {
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      const city = CITIES.find((c) => c.name === cityName)
      autocompletePlaces(query, city)
        .then((results) => {
          if (requestId !== requestIdRef.current) return // stale response, a newer query superseded it
          setSuggestions(results)
          setError(null)
        })
        .catch((err) => {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setError(err.message || 'Search unavailable')
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    }, 300)

    return () => clearTimeout(timerRef.current)
  }, [query, cityName])

  return { suggestions, loading, error }
}
