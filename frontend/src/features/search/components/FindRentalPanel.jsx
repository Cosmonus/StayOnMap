import { useState, useEffect } from 'react'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import CityDropdown from './CityDropdown'
import AreaInput from './AreaInput'

const BHK_OPTIONS = [
  { label: '1 BHK', value: 1 },
  { label: '2 BHK', value: 2 },
  { label: '3 BHK', value: 3 },
  { label: '4+ BHK', value: 4 },
]

/* ── Main panel ── */
export default function FindRentalPanel({ side = 'left', floating = true }) {
  const { filters, setFilters, resetFilters } = useFilterStore()

  const [draft, setDraft] = useState({
    city: filters.city ?? '',
    area: filters.area ?? '',
    bhk:  filters.bhk  ?? [],
  })

  useEffect(() => {
    setDraft({
      city: filters.city ?? '',
      area: filters.area ?? '',
      bhk:  filters.bhk  ?? [],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.area, filters.bhk])

  function toggleBhk(val) {
    setDraft((d) => ({
      ...d,
      bhk: d.bhk.includes(val) ? d.bhk.filter((v) => v !== val) : [...d.bhk, val],
    }))
  }

  function handleApply() {
    setFilters({ city: draft.city, area: draft.area, bhk: draft.bhk })
  }

  function handleReset() {
    resetFilters()
    setDraft({ city: '', area: '', bhk: [] })
    useMapStore.getState().setSearchedPlace(null)
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify({
    city: filters.city ?? '',
    area: filters.area ?? '',
    bhk:  filters.bhk  ?? [],
  })

  const floatingCls = floating
    ? `fixed z-20 ${side === 'right' ? 'right-6 top-20 max-h-[calc(100vh-5rem)]' : 'left-6 top-24 max-h-[calc(100vh-7rem)]'}`
    : 'max-h-[50vh]'

  return (
    <div className={`hidden md:flex flex-col w-full bg-white rounded-2xl shadow-float border border-slate-200 overflow-hidden ${floatingCls}`}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-0.5">Filter rentals</p>
          <h2 className="text-sm font-bold text-slate-900 leading-tight">Find your perfect home</h2>
        </div>
        {isDirty && (
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Reset
          </button>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
          <CityDropdown
            value={draft.city}
            onChange={(val) => setDraft((d) => ({ ...d, city: val, area: '' }))}
          />
        </div>

        {/* Area */}
        <AreaInput
          value={draft.area}
          city={draft.city}
          onChange={(val) => setDraft((d) => ({ ...d, area: val }))}
        />

        {/* Bedrooms */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bedrooms</label>
          <div className="flex gap-1.5 flex-wrap">
            {BHK_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => toggleBhk(value)}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150',
                  draft.bhk.includes(value)
                    ? 'bg-[#111111] text-white border-[#111111] shadow-sm'
                    : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-slate-400',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-2 shrink-0">
        <button
          onClick={handleApply}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {draft.city ? `Show rentals in ${draft.city}` : 'Show matching rentals'}
        </button>
      </div>

    </div>
  )
}
