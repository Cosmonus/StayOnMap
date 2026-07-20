import ModuleCard from './ModuleCard'
import SummaryStrip from './SummaryStrip'

// Spatial intelligence for a location: a titled group of module cards, each
// opening its own full report.
//
// The panel is a thin mapper — the backend decides which modules exist, in what
// order, and what each has to say. Adding a module never touches this file.
//
// `context` comes joined onto the property payload (properties.service.js's
// getPropertyById), so this costs no extra request. `children` (the
// hand-authored neighbourhood insight, the commute calculator) render in every
// state, including the failure ones, because they don't depend on a
// materialised cell.

// Render order. Not alphabetical, not backend order — this is what a person
// deciding where to live tends to ask first.
// Only the modules relevant to this listing's property type ever arrive — the
// backend does that filtering. This list just fixes their order.
const ORDER = [
  'locality',
  'mobility',
  'lifestyle', 'commerce', 'pgContext', 'stayContext', 'landContext',
  'infrastructure', 'environment', 'terrain', 'costOfLiving',
]

/**
 * Order the modules the backend sent, WITHOUT dropping ones this list hasn't
 * heard of.
 *
 * This used to be `ORDER.map(key => modules[key])`, which silently discarded
 * any module missing from the list — so two backend modules shipped and
 * rendered nowhere, while the file's own comment claimed adding a module never
 * touches it. Appending unknown keys makes a new module degrade to "in the
 * wrong position" instead of "invisible", which is the same choice factIcons.js
 * makes with its neutral-dot fallback.
 */
function inRenderOrder(modules) {
  const known = ORDER.filter((key) => modules[key])
  const unknown = Object.keys(modules).filter((key) => !ORDER.includes(key))
  return [...known, ...unknown].map((key) => modules[key])
}

export default function SpatialContextPanel({ context, coords, children }) {
  const modules = context?.modules ?? {}

  const envelopes = inRenderOrder(modules)
    .filter(Boolean)
    // Envelopes are stored as raw JSON, so a row written by an older module
    // shape can reach here without `facts`. Skipping it degrades to a missing
    // card; indexing it throws mid-render and blanks the whole section.
    .filter((e) => Array.isArray(e.facts))
    // A module with nothing to say AND nothing to explain is chrome. One that
    // knows why it's silent is kept — that's information.
    .filter((e) => e.facts.length > 0 || e.missing?.length > 0)

  // Four outcomes, not two. `status` is the backend's word for which one this
  // is (spatial.service.js); `pending` is the older boolean, still read here so
  // a cached payload from before `status` shipped keeps working.
  //
  // The reason this matters: every branch below used to fall through to the
  // same bare heading — a title, a Beta pill, and "tap any card for the full
  // report" above nothing at all. A layer whose whole argument is "never show
  // an unexplained number" should not show an unexplained absence either.
  const status = context?.status
    ?? (context?.pending === true ? 'pending' : context ? 'ready' : null)

  const pending = status === 'pending'
  const failed = status === 'failed'
  // Computed successfully and genuinely had nothing to report. Real, and common
  // in thinly-mapped cities — it is an answer, so it gets said out loud.
  const nothingMapped = status === 'ready' && envelopes.length === 0

  const hasPanel = envelopes.length > 0 || pending || failed || nothingMapped

  // No context at all (an older payload that predates this field): render the
  // children on their own rather than heading a section with no content.
  if (!hasPanel) return children ?? null

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

      {failed && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-700">
            We couldn&apos;t load the area report
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            Something went wrong on our side — this isn&apos;t a comment on the
            neighbourhood. Reloading usually fixes it.
          </p>
        </div>
      )}

      {nothingMapped && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-700">
            We don&apos;t have enough mapped data around this address yet
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            Our area reports are built from open map data, and coverage is
            thinner in some neighbourhoods than others. That says nothing about
            what&apos;s actually here — only about what has been mapped so far.
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
