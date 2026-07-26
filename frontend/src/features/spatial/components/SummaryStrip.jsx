import { factIcon } from '../factIcons'

// "Around this location" at a glance — one chip per thing that exists nearby,
// with its real count, before any card is opened.
//
// Chips are built ONLY from facts that carry a `count` (real data the backend
// measured), never parsed out of display prose. A chip is a shortcut, not a
// claim of its own: clicking scrolls to the module card that owns the number,
// where the radius, confidence and caveats live.
//
// The sparse-mapping note is load-bearing: in a lightly-mapped OSM area a low
// count is absence of data, not absence of shops, and a confident-looking
// count strip is exactly where that distinction would silently die.

const MAX_CHIPS = 8

// "Bus stops within 800 m" → "Bus stops". The radius still shows on the
// card the chip scrolls to; a chip repeating it reads as clutter.
const shortLabel = (label) => label.replace(/ within .*$/i, '')

export default function SummaryStrip({ envelopes }) {
  const seen = new Set()
  const chips = []

  for (const envelope of envelopes) {
    for (const fact of envelope.facts) {
      if (!(fact.count > 0) || seen.has(fact.key)) continue
      seen.add(fact.key)
      chips.push({
        factKey: fact.key,
        moduleKey: envelope.key,
        label: shortLabel(fact.label),
        count: fact.count,
      })
    }
  }

  if (chips.length === 0) return null

  const sparse = envelopes.some((e) => e.sparselyMapped === true)

  const jumpTo = (moduleKey) => {
    document
      .getElementById(`spatial-module-${moduleKey}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Around this location
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Nearby place counts">
        {chips.slice(0, MAX_CHIPS).map((chip) => {
          const Icon = factIcon(chip.factKey)
          return (
            <button
              key={chip.factKey}
              type="button"
              onClick={() => jumpTo(chip.moduleKey)}
              aria-label={`${chip.count} ${chip.label} nearby — jump to details`}
              className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden="true" />
              <span className="font-bold text-slate-800">{chip.count}</span>
              <span>{chip.label}</span>
            </button>
          )
        })}
      </div>
      {sparse && (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
          This area looks lightly mapped in OpenStreetMap — counts are a floor,
          not a total.
        </p>
      )}
    </div>
  )
}
