import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { useUiStore } from '@store/uiStore'
import { countActiveFilters } from '@/config/filters'
import { resolvePlace } from '@lib/googleMaps'
import PropertyPopup from './PropertyPopup'
import PropertyCard from '@features/properties/components/PropertyCard'
import CityDropdown from '@features/search/components/CityDropdown'
import AreaInput from '@features/search/components/AreaInput'
import { propertyService } from '@services/property.service'

/* ─── Mobile search form (city + area) ───────────────────────
   Search only — every other filter lives in the shared FilterModal,
   which the FAB's "Filters" button opens (same modal as the header). */
function SearchBody({ draft, setDraft, onApply, onReset, hasActive }) {
  // City selection zooms the map right away, instead of waiting for "Search"
  function handleCityChange(val) {
    setDraft((d) => ({ ...d, city: val, area: '' }))
    useFilterStore.getState().setFilter('city', val)
    useFilterStore.getState().setFilter('area', '')
  }

  return (
    <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">City</label>
        <CityDropdown
          value={draft.city}
          onChange={handleCityChange}
        />
      </div>

      <AreaInput
        value={draft.area}
        city={draft.city}
        onChange={(val) => setDraft((d) => ({ ...d, area: val }))}
      />

      <div className="flex gap-2 pt-1">
        {hasActive && (
          <button
            onClick={onReset}
            className="px-3 py-2.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Reset
          </button>
        )}
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors duration-150 active:scale-[0.98]"
        >
          <Search size={13} strokeWidth={2.5} />
          {draft.city ? `Search in ${draft.city}` : 'Search'}
        </button>
      </div>
    </div>
  )
}

/* ─── Sheet drag handle + header ─────────────────────────── */
function SheetHeader({ title, onClose }) {
  return (
    <>
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>
    </>
  )
}

/* ─── Mobile property card (fetches + renders PropertyCard) ── */
function MobilePropertyCard({ propertyId }) {
  const { data: property, isLoading } = useQuery({
    queryKey: ['property-popup', propertyId],
    queryFn:  () => propertyService.getById(propertyId).then((r) => r.data),
    enabled:  !!propertyId,
    staleTime: 60_000,
  })

  if (isLoading) return (
    <div className="p-4 flex flex-col gap-3">
      <div className="animate-pulse rounded-2xl bg-slate-100 aspect-[4/3]" />
      <div className="h-5 bg-slate-100 rounded-lg animate-pulse w-3/4" />
      <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/2" />
    </div>
  )

  if (!property) return null

  return (
    <div className="p-4 pb-6">
      <PropertyCard property={property} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function MapRightPanel({ topClass = 'top-32', contained = false }) {
  const selectedPinId  = useMapStore((s) => s.selectedPinId)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const { filters, setFilters } = useFilterStore()
  const openFilterModal = useUiStore((s) => s.openFilterModal)

  const [mobileSheet, setMobileSheet] = useState(null)            // mobile sheet: 'search' | null
  const [draft, setDraft]           = useState({ city: '', area: '' })

  useEffect(() => {
    setDraft({ city: filters.city ?? '', area: filters.area ?? '' })
  }, [filters.city, filters.area])

  async function handleApply() {
    useMapStore.getState().clearSelection()
    setFilters({ city: draft.city, area: draft.area })
    setMobileSheet(null)

    // Fly to the searched area, same as the desktop search bar
    const query = draft.area.trim()
    if (!query) return
    const place = await resolvePlace(query, draft.city).catch(() => null)
    if (!place) return
    useMapStore.getState().flyTo?.({ center: [place.lng, place.lat], zoom: 16, duration: 800 })
    useMapStore.getState().setSearchedPlace(place)
  }

  function handleReset() {
    // Reset only what this sheet controls — modal filters are cleared from
    // the filter modal itself
    setFilters({ city: '', area: '' })
    setDraft({ city: '', area: '' })
    useMapStore.getState().setSearchedPlace?.(null)
  }

  const hasActiveSearch = Boolean(draft.city || draft.area)
  const modalFilterCount = countActiveFilters(filters)

  const PANEL_SHADOW = { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }

  return (
    <>
      {/* ══ DESKTOP: selected-property popup (Metro/IT/Traffic toggles now live in MapControls' pills) ══ */}
      <div
        className={`hidden md:flex flex-col ${contained ? 'absolute' : 'fixed'} right-5 ${topClass} z-20 w-80 gap-3 overflow-y-auto`}
        style={{ maxHeight: 'calc(100vh - 6rem)', scrollbarWidth: 'none' }}
      >
        {selectedPinId && <PropertyPopup />}
      </div>

      {/* ══ MOBILE: FAB bar — search sheet + the shared filter modal ══ */}
      {!selectedPinId && (
        <div className={`md:hidden ${contained ? 'absolute' : 'fixed'} bottom-5 inset-x-4 z-20 flex gap-2`}>
          <button
            onClick={() => setMobileSheet('search')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-lg text-sm font-semibold text-slate-700 active:scale-[0.97] transition-transform"
            style={PANEL_SHADOW}
          >
            <Search size={15} strokeWidth={2} />
            Search area
            {hasActiveSearch && <span className="w-2 h-2 rounded-full bg-brand-600" />}
          </button>
          <button
            onClick={openFilterModal}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-lg text-sm font-semibold text-slate-700 active:scale-[0.97] transition-transform"
            style={PANEL_SHADOW}
          >
            <SlidersHorizontal size={15} strokeWidth={2} />
            Filters
            {modalFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                {modalFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ══ MOBILE: search bottom sheet ═══════════════════════ */}
      {mobileSheet === 'search' && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSheet(null)} />

          {/* Sheet */}
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '82vh' }}
          >
            <SheetHeader
              title="Search area"
              onClose={() => setMobileSheet(null)}
            />
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(82vh - 72px)', scrollbarWidth: 'none' }}>
              <SearchBody
                draft={draft}
                setDraft={setDraft}
                onApply={handleApply}
                onReset={handleReset}
                hasActive={hasActiveSearch}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ MOBILE: property bottom sheet ════════════════════ */}
      {selectedPinId && (
        <div className="md:hidden fixed inset-0 z-30">
          {/* Tap-outside to close */}
          <div className="absolute inset-0 bg-black/20" onClick={clearSelection} />

          {/* Sheet */}
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl overflow-y-auto"
            style={{ maxHeight: '62vh', scrollbarWidth: 'none', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <MobilePropertyCard propertyId={selectedPinId} />
          </div>
        </div>
      )}
    </>
  )
}
