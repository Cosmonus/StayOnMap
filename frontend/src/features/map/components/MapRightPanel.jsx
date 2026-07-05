import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import PropertyPopup from './PropertyPopup'
import PropertyCard from '@features/properties/components/PropertyCard'
import CityDropdown from '@features/search/components/CityDropdown'
import AreaInput from '@features/search/components/AreaInput'
import { propertyService } from '@services/property.service'

/* ─── Constants ──────────────────────────────────────────── */
const BHK_OPTIONS = [
  { label: '1 BHK', value: 1 },
  { label: '2 BHK', value: 2 },
  { label: '3 BHK', value: 3 },
  { label: '4+',    value: 4 },
]

const BHK_QUERY_RE = /^\s*(\d+)\s*\+?\s*bhk\.?\s*$/i

const FURNISHED_OPTIONS = [
  { label: 'Fully',  value: 'FULLY' },
  { label: 'Semi',   value: 'SEMI' },
  { label: 'None',   value: 'UNFURNISHED' },
]

/* ─── Shared filter form ─────────────────────────────────── */
export function FilterBody({ draft, setDraft, activeFilterCount, onApply, onReset }) {
  function toggleBhk(val) {
    setDraft((d) => ({
      ...d,
      bhk: d.bhk.includes(val) ? d.bhk.filter((v) => v !== val) : [...d.bhk, val],
    }))
  }

  // City selection zooms the map right away, instead of waiting for "Show matches"
  function handleCityChange(val) {
    setDraft((d) => ({ ...d, city: val, area: '' }))
    useFilterStore.getState().setFilter('city', val)
    useFilterStore.getState().setFilter('area', '')
  }

  // "2bhk" typed into the area box isn't a place — treat it as a Bedrooms filter instead
  function handleAreaChange(val) {
    const bhkMatch = val.match(BHK_QUERY_RE)
    if (bhkMatch) {
      const bhkValue = Math.min(Number(bhkMatch[1]), 4)
      setDraft((d) => ({
        ...d,
        area: '',
        bhk: d.bhk.includes(bhkValue) ? d.bhk : [...d.bhk, bhkValue],
      }))
      return
    }
    setDraft((d) => ({ ...d, area: val }))
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
        onChange={handleAreaChange}
      />

      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bedrooms</label>
        <div className="flex gap-1.5">
          {BHK_OPTIONS.map(({ label, value }) => {
            const sel = draft.bhk.includes(value)
            return (
              <button
                key={value}
                onClick={() => toggleBhk(value)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border transition-all duration-150"
                style={sel
                  ? { background: 'linear-gradient(135deg,#1e293b,#334155)', color: '#fff', borderColor: 'transparent', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }
                  : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Furnishing</label>
        <div className="flex gap-1.5">
          {FURNISHED_OPTIONS.map(({ label, value }) => {
            const sel = draft.furnished === value
            return (
              <button
                key={value}
                onClick={() => setDraft((d) => ({ ...d, furnished: sel ? null : value }))}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border transition-all duration-150"
                style={sel
                  ? { background: 'linear-gradient(135deg,#1e293b,#334155)', color: '#fff', borderColor: 'transparent', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }
                  : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {activeFilterCount > 0 && (
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
          {draft.city ? `Show in ${draft.city}` : 'Show matches'}
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
  const { filters, setFilters, resetFilters } = useFilterStore()

  const [mobileSheet, setMobileSheet] = useState(null)            // mobile sheet: 'filters' | null
  const [draft, setDraft]           = useState({ city: '', area: '', bhk: [], furnished: null })

  useEffect(() => {
    setDraft({ city: filters.city ?? '', area: filters.area ?? '', bhk: filters.bhk ?? [], furnished: filters.furnished ?? null })
  }, [filters.city, filters.area, filters.bhk, filters.furnished]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApply() {
    useMapStore.getState().clearSelection()
    setFilters({ city: draft.city, area: draft.area, bhk: draft.bhk, furnished: draft.furnished })
    setMobileSheet(null)
  }

  function handleReset() {
    resetFilters()
    setDraft({ city: '', area: '', bhk: [], furnished: null })
    useMapStore.getState().setSearchedPlace?.(null)
  }

  const activeFilterCount = [draft.city, draft.area, draft.furnished, ...draft.bhk].filter(Boolean).length

  const filterProps = { draft, setDraft, activeFilterCount, onApply: handleApply, onReset: handleReset }

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

      {/* ══ MOBILE: FAB bar ══════════════════════════════════ */}
      {!selectedPinId && (
        <div className={`md:hidden ${contained ? 'absolute' : 'fixed'} bottom-5 inset-x-4 z-20 flex gap-2`}>
          <button
            onClick={() => setMobileSheet('filters')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-lg text-sm font-semibold text-slate-700 active:scale-[0.97] transition-transform"
            style={PANEL_SHADOW}
          >
            <Search size={15} strokeWidth={2} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ══ MOBILE: filter bottom sheet ═══════════════════════ */}
      {mobileSheet && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSheet(null)} />

          {/* Sheet */}
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '82vh' }}
          >
            <SheetHeader
              title="Filter rentals"
              onClose={() => setMobileSheet(null)}
            />
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(82vh - 72px)', scrollbarWidth: 'none' }}>
              <FilterBody {...filterProps} />
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
