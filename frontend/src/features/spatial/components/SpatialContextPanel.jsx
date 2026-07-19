import ModuleCard from './ModuleCard'
import SummaryStrip from './SummaryStrip'

// Spatial intelligence for a location: a titled group of module cards, each
// opening its own full report.
//
// The panel is a thin mapper — the backend decides which modules exist, in what
// order, and what each has to say. Adding a module never touches this file.
//
// `context` comes joined onto the property payload (properties.service.js's
// getPropertyById), so this costs no extra request. A location we haven't
// described yet arrives as null: the module cards vanish but `children` (the
// hand-authored neighbourhood insight, the commute calculator) still render,
// because those don't depend on a materialised cell.

// Render order. Not alphabetical, not backend order — this is what a person
// deciding where to live tends to ask first.
// Only the modules relevant to this listing's property type ever arrive — the
// backend does that filtering. This list just fixes their order.
const ORDER = [
  'mobility',
  'lifestyle', 'commerce', 'pgContext', 'stayContext', 'landContext',
  'infrastructure', 'environment', 'costOfLiving',
]

export default function SpatialContextPanel({ context, coords, children }) {
  const modules = context?.modules ?? {}

  const envelopes = ORDER
    .map((key) => modules[key])
    .filter(Boolean)
    // A module with nothing to say AND nothing to explain is chrome. One that
    // knows why it's silent is kept — that's information.
    .filter((e) => e.facts.length > 0 || e.missing?.length > 0)

  // "We haven't looked yet" is not the same as "there's nothing here", and an
  // empty section under a confident heading says the second one.
  const pending = context?.pending === true

  if (envelopes.length === 0 && !pending && !children) return null

  return (
    <section className="space-y-4" aria-labelledby="spatial-intelligence-heading">
      <div>
        <div className="flex items-center gap-2">
          <h2 id="spatial-intelligence-heading" className="text-base font-bold text-slate-900">
            Spatial intelligence
          </h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
            Beta
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">
          What the area around this address is actually like — tap any card for
          the full report, where each figure came from, and what we don&apos;t know.
        </p>
      </div>

      {pending && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-700">Working out what&apos;s around this address</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            We haven&apos;t described this neighbourhood yet. It usually takes a
            few seconds — reload the page shortly and it&apos;ll be here.
          </p>
        </div>
      )}

      {/* The at-a-glance count strip — real counts from the facts, each chip
          jumping to the card that owns (and caveats) its number. */}
      {envelopes.length > 0 && <SummaryStrip envelopes={envelopes} />}

      {envelopes.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {envelopes.map((e) => <ModuleCard key={e.key} envelope={e} coords={coords} />)}
        </div>
      )}

      {children}
    </section>
  )
}
