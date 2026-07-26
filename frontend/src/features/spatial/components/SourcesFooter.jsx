// Where this module's facts came from, and when.
//
// Collapsed by default — unlike MissingDataNote, this is provenance detail
// rather than a finding, and the per-fact chips already carry the signal that
// matters at a glance.
export default function SourcesFooter({ sources, computedAt }) {
  if (!sources?.length && !computedAt) return null

  return (
    <details className="mt-2 group">
      <summary className="text-[10px] text-slate-400 cursor-pointer list-none hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
        Sources &amp; freshness
        <span aria-hidden="true" className="ml-1 group-open:hidden">▸</span>
        <span aria-hidden="true" className="ml-1 hidden group-open:inline">▾</span>
      </summary>

      <div className="mt-1.5 space-y-0.5">
        {sources?.map((s) => (
          <p key={s.name} className="text-[10px] text-slate-400">
            {s.name}
            {s.license && <span className="text-slate-300"> · {s.license}</span>}
            {s.fetchedAt && <span className="text-slate-300"> · {s.fetchedAt}</span>}
          </p>
        ))}
        {computedAt && (
          <p className="text-[10px] text-slate-400">
            Calculated {new Date(computedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    </details>
  )
}
