import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { CITIES } from '@/config/cities'
import AreaInput from '@features/search/components/AreaInput'

const BHK_OPTIONS = [
  { value: '',  label: 'Any BHK' },
  { value: '1', label: '1 BHK' },
  { value: '2', label: '2 BHK' },
  { value: '3', label: '3 BHK' },
  { value: '4', label: '4+ BHK' },
]

const FURNISHED_OPTIONS = [
  { value: '',             label: 'Any furnishing' },
  { value: 'FULLY',        label: 'Fully furnished' },
  { value: 'SEMI',         label: 'Semi furnished' },
  { value: 'UNFURNISHED',  label: 'Unfurnished' },
]

function Divider() {
  return <span className="w-px h-6 bg-slate-200 shrink-0" />
}

// Custom-styled select — a plain native <select> can't have a designed
// (rounded, app-matching) options panel, only the closed trigger, so the
// dropdown always looked bare/default once opened. This one is fully styled,
// using the same `position: fixed` (not `absolute` + scrollY) trigger-rect
// math already fixed elsewhere in this app for controls that live inside the
// fixed header.
function SelectField({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e) {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false)
    }
    function onEsc(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function handleToggle() {
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 180) })
    setOpen((v) => !v)
  }

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="h-9 flex items-center gap-1.5 pl-3 pr-2.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-400 transition-colors"
      >
        {selected?.label}
        <ChevronDown size={12} color="#94a3b8" strokeWidth={2.5} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-72 overflow-y-auto"
        >
          {options.map((o) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors ${
                  isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

export default function MapFilterBar() {
  const filters    = useFilterStore((s) => s.filters)
  const setFilters = useFilterStore((s) => s.setFilters)

  // Local draft — selecting/typing only updates this. Nothing is applied to
  // the shared filterStore (and the map doesn't refetch) until "Search" is clicked.
  const [draft, setDraft] = useState({ area: '', city: '', bhk: [], furnished: null })

  useEffect(() => {
    setDraft({
      area: filters.area ?? '',
      city: filters.city ?? '',
      bhk: filters.bhk ?? [],
      furnished: filters.furnished ?? null,
    })
  }, [filters.area, filters.city, filters.bhk, filters.furnished])

  function handleSearch() {
    useMapStore.getState().clearSelection()
    setFilters({ area: draft.area, city: draft.city, bhk: draft.bhk, furnished: draft.furnished })

    if (draft.area?.trim() && window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder()
      const address  = draft.city ? `${draft.area}, ${draft.city}, India` : `${draft.area}, India`
      geocoder.geocode({ address, region: 'in' }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) return
        const loc = results[0].geometry.location
        useMapStore.getState().flyTo?.({ center: [loc.lng(), loc.lat()], zoom: 16, duration: 800 })
        useMapStore.getState().setSearchedPlace({ name: draft.area, lat: loc.lat(), lng: loc.lng() })
      })
      return
    }

    const cityData = CITIES.find((c) => c.name === draft.city)
    if (cityData) useMapStore.getState().flyTo?.({ center: [cityData.lng, cityData.lat], zoom: 12 })
  }

  const cityOptions = [{ value: '', label: 'All cities' }, ...CITIES.map((c) => ({ value: c.name, label: c.name }))]

  return (
    <div className="hidden md:flex items-center gap-2.5 h-14 pl-4 pr-2 bg-white rounded-full border border-slate-200">
      <div className="w-72">
        <AreaInput
          value={draft.area}
          city={draft.city}
          onChange={(v) => setDraft((d) => ({ ...d, area: v }))}
          showLabel={false}
          bare
        />
      </div>
      <Divider />
      <SelectField
        value={draft.city}
        options={cityOptions}
        onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
      />
      <SelectField
        value={draft.bhk.length === 1 ? String(draft.bhk[0]) : ''}
        options={BHK_OPTIONS}
        onChange={(v) => setDraft((d) => ({ ...d, bhk: v ? [Number(v)] : [] }))}
      />
      <SelectField
        value={draft.furnished ?? ''}
        options={FURNISHED_OPTIONS}
        onChange={(v) => setDraft((d) => ({ ...d, furnished: v || null }))}
      />
      <button
        type="button"
        onClick={handleSearch}
        aria-label="Search rentals"
        className="w-10 h-10 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shrink-0 transition-colors"
      >
        <Search size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
