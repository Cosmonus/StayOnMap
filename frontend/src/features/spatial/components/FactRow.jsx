import ProvenanceChip from './ProvenanceChip'
import { factIcon } from '../factIcons'

// One fact: what it is, what it says, and where it came from.
//
// The icon is the scanning aid — these lists run to ten rows in the lifestyle
// and mobility reports, and "nearest pharmacy" vs "nearest hospital" is far
// quicker to find by symbol than by reading every label.
export default function FactRow({ fact }) {
  const Icon = factIcon(fact.key)

  return (
    <div className="flex items-start gap-3 border-b border-slate-50 py-2.5 last:border-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        <Icon className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{fact.label}</p>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-800">{fact.display}</p>
        {/* The method is shown inline, not only on hover — an estimate whose
            basis is hidden behind a tooltip is an estimate most people will
            read as a measurement. */}
        {fact.method && (
          <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{fact.method}</p>
        )}
      </div>

      <ProvenanceChip provenance={fact.provenance} method={fact.method} />
    </div>
  )
}
