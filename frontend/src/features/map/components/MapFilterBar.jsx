// The map header's search bar — a location search + submit, nothing else.
// Search is location-only by design (no city selector); every other filter
// (property type, BHK, furnishing, budget, …) lives in the filter modal next
// to this bar. Rendered on all screen sizes: on mobile this is the only
// search surface (the map itself has no floating search controls).
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { resolvePlace } from '@lib/googleMaps'
import AreaInput from '@features/search/components/AreaInput'

export default function MapFilterBar() {
  const storedArea = useFilterStore((s) => s.filters.area)
  const city       = useFilterStore((s) => s.filters.city)
  const setFilter  = useFilterStore((s) => s.setFilter)

  // Local draft — typing only updates this; the map flies on "Search"
  const [area, setArea] = useState('')
  useEffect(() => { setArea(storedArea ?? '') }, [storedArea])

  async function handleSearch() {
    const query = area.trim()
    if (!query) return
    useMapStore.getState().clearSelection()
    setFilter('area', query)

    const place = await resolvePlace(query, city).catch(() => null)
    if (!place) return
    useMapStore.getState().flyTo?.({ center: [place.lng, place.lat], zoom: 16, duration: 800 })
    useMapStore.getState().setSearchedPlace(place)
  }

  return (
    <div className="flex flex-1 md:flex-initial items-center gap-2 md:gap-2.5 h-12 md:h-14 pl-4 pr-1.5 md:pr-2 bg-white rounded-full border border-slate-200">
      <div className="flex-1 min-w-0 md:flex-none md:w-96">
        <AreaInput
          value={area}
          city={city}
          onChange={setArea}
          showLabel={false}
          bare
        />
      </div>
      <button
        type="button"
        onClick={handleSearch}
        aria-label="Search rentals"
        className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shrink-0 transition-colors"
      >
        <Search size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
