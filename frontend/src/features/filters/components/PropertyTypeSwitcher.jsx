// Property-type category cards (same 6 categories, colors and icons as the
// listing wizard and the map pins). Single-select: one category at a time —
// mixing e.g. Land with PG stacks unrelated filter sections and produces a
// result set nobody asked for. Tap the active card again to clear back to
// "all types". (A category can still map to several enum types internally,
// e.g. House → HOUSE/VILLA/INDEPENDENT_HOUSE.) Selection drives which filter
// sections render below — the core of the dynamic filter system.
import { TYPE_CATEGORIES } from '@/config/filters'

const intersects = (a, b) => a.some((v) => b.includes(v))

export default function PropertyTypeSwitcher({ selectedTypes, onChange }) {
  function toggle(category) {
    onChange(intersects(selectedTypes, category.types) ? [] : [...category.types])
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {TYPE_CATEGORIES.map((category) => {
        const Icon = category.icon
        const active = intersects(selectedTypes, category.types)
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category)}
            aria-pressed={active}
            style={active ? { borderColor: category.color, color: category.color } : undefined}
            className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              active ? 'bg-slate-50 font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            <span className="text-xs">{category.label}</span>
          </button>
        )
      })}
    </div>
  )
}
