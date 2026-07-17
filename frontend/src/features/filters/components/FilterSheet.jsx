// The filter modal's body — centered on desktop, bottom sheet on mobile.
// Presentational: it owns a local DRAFT and hands it back on Apply; the caller
// decides where that lands (the user map's filterStore, the admin panel's
// local state). Nothing changes until Apply.
//
// `sections`/`defs`/`defaults` default to the user filter config, so the map's
// FilterModal passes none of them; the admin panel passes its superset from
// config/adminFilters.js. Same argument shape as config/filters.js's helpers.
import { useEffect, useState } from 'react'
import Modal from '@components/common/Modal'
import {
  PARAM_DEFS, FILTER_SECTIONS, DEFAULT_FILTERS, SEARCH_KEYS, TYPE_CATEGORIES, LEASE_CATEGORY_IDS,
  countActiveFilters, staleFilterPatch, modeChangePatch,
} from '@/config/filters'
import { useFilterCount } from '../hooks/useFilterCount'
import PropertyTypeSwitcher from './PropertyTypeSwitcher'
import DynamicFilterRenderer from './DynamicFilterRenderer'

// Rent vs Lease: two different deals, not two price ranges. Rent is monthly;
// lease is the Kerala/Karnataka lump sum the owner returns when you leave.
// One mode at a time — see PricingModel in schema.prisma.
const MODES = [
  { value: 'RENT', label: 'Rent', hint: 'Pay monthly' },
  { value: 'LEASE', label: 'Lease', hint: 'Lump sum, refunded on exit' },
]

const LEASE_CATEGORIES = TYPE_CATEGORIES.filter((c) => LEASE_CATEGORY_IDS.includes(c.id))

export default function FilterSheet({
  isOpen,
  onClose,
  value,
  onApply,
  sections = FILTER_SECTIONS,
  defs = PARAM_DEFS,
  defaults = DEFAULT_FILTERS,
  showCount = true,
  showModeToggle = true,
}) {
  const [draft, setDraft] = useState(value)

  // Re-seed the draft from the caller each time the sheet opens
  useEffect(() => {
    if (isOpen) setDraft(value)
    // `value` intentionally omitted — re-seeding on every caller-side change
    // would clobber the draft mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // The live count only exists for the public map (GET /properties/count is an
  // ACTIVE-only, no-status-param endpoint), so admin opts out and the button
  // falls back to "Show results". The hook still runs — disabled, not skipped.
  const { count, isFetching } = useFilterCount(draft, isOpen && showCount)
  const activeCount = countActiveFilters(draft, defs)

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  const mode = draft.pricingModel || 'RENT'
  const categories = mode === 'LEASE' ? LEASE_CATEGORIES : TYPE_CATEGORIES

  // Switching modes resets the mode-gated rows (the two budget rows share
  // rentMin/rentMax on different scales) and drops any now-ineligible type
  // selection — picking PG then switching to Lease would otherwise filter to
  // "leased PGs", which can't exist.
  function handleModeChange(next) {
    const types = (draft.types ?? []).filter(
      (t) => next !== 'LEASE' || LEASE_CATEGORIES.some((c) => c.types.includes(t))
    )
    patch({
      pricingModel: next,
      types,
      ...modeChangePatch(sections, defs),
      ...staleFilterPatch(types, sections, defs, next),
    })
  }

  function handleReset() {
    setDraft((d) => ({
      ...defaults,
      ...Object.fromEntries(SEARCH_KEYS.map((k) => [k, d[k]])),
    }))
  }

  function handleApply() {
    onApply(draft)
    onClose()
  }

  const applyLabel = count === null
    ? 'Show results'
    : `Show ${count} ${count === 1 ? 'place' : 'places'}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filters" size="2xl" sheet
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={activeCount === 0}
            className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:text-slate-300 disabled:no-underline transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={`px-6 py-2.5 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-all active:scale-[0.98] ${isFetching ? 'opacity-80' : ''}`}
          >
            {applyLabel}
          </button>
        </div>
      }
    >
      {showModeToggle && (
        <div className="pt-1 pb-6 border-b border-slate-100">
          <p className="text-[15px] font-semibold text-slate-900 mb-3">Looking to</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => {
              const active = mode === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleModeChange(m.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-2xl border transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    active
                      ? 'border-[#111111] bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{m.label}</span>
                  <span className="text-[11px] text-slate-400 leading-tight text-left">{m.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="pt-1 pb-6 border-b border-slate-100">
        <p className="text-[15px] font-semibold text-slate-900 mb-3">Property type</p>
        <PropertyTypeSwitcher
          selectedTypes={draft.types ?? []}
          categories={categories}
          onChange={(types) => patch({ types, ...staleFilterPatch(types, sections, defs, mode) })}
        />
      </div>
      <DynamicFilterRenderer draft={draft} patch={patch} sectionConfig={sections} defs={defs} />
    </Modal>
  )
}
