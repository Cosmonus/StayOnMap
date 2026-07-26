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
import { toast } from '@components/common/Toaster'
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
    if (!query) {
      // Emptying the box and searching = clearing the search. Without this
      // there was no way to un-search an area on the grid page.
      if (storedArea) setFilter('area', '')
      return
    }
    useMapStore.getState().clearSelection()
    // Committing the area is what moves the map: MapView owns the camera and
    // flies on `area` changing. Flying here as well meant one search fired two
    // competing camera moves — fitBounds to the city's extent, and a fixed
    // street zoom on its centre — and whichever landed last won.
    setFilter('area', query)

    const place = await resolvePlace(query, city).catch(() => null)
    if (!place) {
      // Previously a silent `return`, which left the box and the URL saying
      // Bengaluru while the map had not moved an inch and nothing said why.
      toast.error(`We couldn't find "${query}". Try a nearby landmark or area.`)
      return
    }
    useMapStore.getState().setSearchedPlace(place)
  }

  // Picking a suggestion commits the search, rather than only nudging the
  // camera. It used to fly the map but never set `area`, so the URL stayed
  // empty, the page heading stayed generic, a reload lost the place, and
  // "See them as a list" handed the grid no location at all.
  function handlePlacePicked(place) {
    useMapStore.getState().clearSelection()
    setFilter('area', place.name)
    useMapStore.getState().setSearchedPlace({ name: place.name, lat: place.lat, lng: place.lng })
  }

  return (
    <div className="flex flex-1 md:flex-initial items-center gap-2 md:gap-2.5 h-12 md:h-14 pl-4 pr-1.5 md:pr-2 bg-white rounded-full border border-slate-200">
      <div className="flex-1 min-w-0 md:flex-none md:w-96">
        <AreaInput
          value={area}
          city={city}
          onChange={setArea}
          onPlacePicked={handlePlacePicked}
          onClear={() => { setFilter('area', ''); useMapStore.getState().setSearchedPlace(null) }}
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
