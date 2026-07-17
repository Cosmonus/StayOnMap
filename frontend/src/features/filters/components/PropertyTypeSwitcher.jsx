// Property-type category cards (same 6 categories, colors and icons as the
// listing wizard and the map pins). Single-select: one category at a time —
// mixing e.g. Land with PG stacks unrelated filter sections and produces a
// result set nobody asked for. Tap the active card again to clear back to
// "all types". (A category can still map to several enum types internally,
// e.g. House → HOUSE/VILLA/INDEPENDENT_HOUSE.) Selection drives which filter
// sections render below — the core of the dynamic filter system.
import { TYPE_CATEGORIES } from '@/config/filters'

const intersects = (a, b) => a.some((v) => b.includes(v))

// gridClass is overridable because these breakpoints are viewport-based, not
// container-based: `sm:grid-cols-6` is right for the full-width filter modal
// but gives each card ~40px inside the admin panel's 288px sidebar, which
// squishes labels like "Commercial" and "Short stay" into nothing.
export default function PropertyTypeSwitcher({ selectedTypes, onChange, gridClass = 'grid-cols-3 sm:grid-cols-6', categories = TYPE_CATEGORIES }) {
  function toggle(category) {
    onChange(intersects(selectedTypes, category.types) ? [] : [...category.types])
  }

  return (
    <div className={`grid gap-2 ${gridClass}`}>
      {categories.map((category) => {
        const Icon = category.icon
        const active = intersects(selectedTypes, category.types)
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category)}
            aria-pressed={active}
            // Active = the type's own color as a soft tint + border, so the
            // card reads as "selected" without a heavy double-stroke box
            style={active ? { borderColor: category.color, color: category.color, backgroundColor: `${category.color}14` } : undefined}
            className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              active ? 'font-semibold' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
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
