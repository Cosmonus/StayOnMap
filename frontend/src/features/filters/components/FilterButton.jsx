// Opens the filter modal; badge shows how many filters are applied.
import { SlidersHorizontal } from 'lucide-react'
import { useUiStore } from '@store/uiStore'
import { useFilterStore } from '@store/filterStore'
import { countActiveFilters } from '@/config/filters'

export default function FilterButton() {
  const openFilterModal = useUiStore((s) => s.openFilterModal)
  const filters = useFilterStore((s) => s.filters)
  const activeCount = countActiveFilters(filters)

  return (
    <button
      type="button"
      onClick={openFilterModal}
      aria-label="Open filters"
      className={`relative h-11 md:h-14 flex items-center gap-2 px-4 rounded-full border bg-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
        activeCount > 0 ? 'border-[#111111] text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-400'
      }`}
    >
      <SlidersHorizontal size={15} strokeWidth={2.25} />
      Filters
      {activeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#111111] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
          {activeCount}
        </span>
      )}
    </button>
  )
}
