import { useFilterStore } from '@store/filterStore'
import { countActiveFilters } from '@features/search/utils/filter.helpers'

const BHK_OPTIONS = [
  { label: 'Studio', value: 0 },
  { label: '1 BHK',  value: 1 },
  { label: '2 BHK',  value: 2 },
  { label: '3 BHK',  value: 3 },
  { label: '4 BHK+', value: 4 },
]

const FURNISHED_OPTIONS = [
  { label: 'Furnished', value: 'FULLY' },
  { label: 'Semi',      value: 'SEMI'  },
  { label: 'Bare',      value: 'UNFURNISHED' },
]

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export default function CategoryChips() {
  const { filters, setFilter, resetFilters } = useFilterStore()
  const filterCount = countActiveFilters(filters)

  function toggleBhk(val) {
    const current = filters.bhk ?? []
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val]
    setFilter('bhk', next)
  }

  function toggleFurnished(val) {
    setFilter('furnished', filters.furnished === val ? null : val)
  }

  const hasFilters = filterCount > 0

  return (
    <div className="sticky top-16 z-30 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-0">

          {/* Scrollable filter chips */}
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 py-3 w-max pr-4">
              {/* Separator */}
              <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

              {/* BHK */}
              {BHK_OPTIONS.map(({ label, value }) => (
                <Chip
                  key={value}
                  label={label}
                  active={(filters.bhk ?? []).includes(value)}
                  onClick={() => toggleBhk(value)}
                />
              ))}

              {/* Separator */}
              <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

              {/* Furnished */}
              {FURNISHED_OPTIONS.map(({ label, value }) => (
                <Chip
                  key={value}
                  label={label}
                  active={filters.furnished === value}
                  onClick={() => toggleFurnished(value)}
                />
              ))}

              {/* Clear all — only when filters active */}
              {hasFilters && (
                <>
                  <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
                  <button
                    onClick={resetFilters}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filters button */}
          <div className="shrink-0 pl-4 border-l border-slate-100 py-3">
            <button className="relative flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-full hover:border-slate-400 hover:bg-slate-50 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              Filters
              {filterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold">
                  {filterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
