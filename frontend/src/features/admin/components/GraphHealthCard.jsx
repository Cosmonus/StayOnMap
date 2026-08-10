import { useQuery } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

// Is the graph actually built?
//
// This answers the question that has gone wrong every time — COVERAGE, not
// speed. Edges are computed on create/edit/moderation, so a listing that was
// already live when the feature shipped has none until somebody runs a backfill,
// and the symptom (an empty "similar homes" row) is indistinguishable from
// "nothing comparable exists".
//
// Every incomplete row prints the exact command that fixes it. A percentage with
// no remedy beside it is one somebody reads, frowns at, and forgets.
function Row({ label, part, total, pct, remedy }) {
  // null means "nothing to divide by" — no listings, no images. That is not 0%.
  const complete = pct === 100 || pct === null

  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-xs text-slate-500 shrink-0">
          <span className="font-mono font-semibold text-slate-800">{part}</span>
          {total != null && <> / {total}</>}
          {pct != null && <> &middot; {pct}%</>}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-slow ${complete ? 'bg-brand-500' : 'bg-warning-500'}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {remedy && (
        <p className="mt-2 text-xs text-slate-600">
          Run <code className="font-mono text-badge bg-slate-100 px-1.5 py-0.5 rounded">{remedy}</code>
        </p>
      )}
    </div>
  )
}

export default function GraphHealthCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['graph-health'],
    queryFn: () => adminService.getGraphHealth().then((r) => r.data),
  })

  if (isLoading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Could not load graph health.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const { listings, similarity, locality, images, tools } = data

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-slate-900 mb-1">Graph coverage</h2>
      <p className="text-xs text-slate-500 mb-4">
        Edges are built when a listing is created, edited or moderated &mdash; listings that
        were already live need a one-off backfill.
      </p>

      <Row
        label="Listings with similar-home edges"
        part={similarity.listingsWithEdges}
        total={listings.active}
        pct={similarity.coveragePct}
        remedy={similarity.remedy}
      />
      <Row
        label="Listings resolved to an area"
        part={locality.resolved}
        total={listings.active}
        pct={locality.coveragePct}
        remedy={locality.remedy}
      />
      <Row
        label="Photos fingerprinted"
        part={images.fingerprinted}
        total={images.total}
        pct={images.coveragePct}
        remedy={images.remedy}
      />

      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-600">
        <p>
          <span className="font-mono font-semibold text-slate-800">{similarity.totalEdges}</span> similarity edges
        </p>
        <p>
          <span className="font-mono font-semibold text-slate-800">{locality.localities}</span> localities
          {locality.aliases > 0 && <> &middot; {locality.aliases} aliases</>}
        </p>
      </div>

      {/* BOUNDARY = the area came from the map. LANDMARK = it fell back to
          owner-typed text, which is permanent for cities OSM has no ward
          polygons for, and a missing boundary seed everywhere else. */}
      {Object.keys(locality.bySource ?? {}).length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Areas by source: {Object.entries(locality.bySource).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(' · ')}
        </p>
      )}

      {tools.latency?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-800 mb-2">Tool latency</p>
          <p className="text-xs text-slate-500 mb-2">
            In-process, last 100 calls each. Resets on restart &mdash; not stored.
          </p>
          <ul className="flex flex-col gap-1">
            {tools.latency.map((t) => (
              <li key={t.tool} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-mono text-slate-700 truncate">{t.tool}</span>
                <span className="text-slate-500 shrink-0">
                  {t.calls} calls &middot; p50 {t.p50}ms &middot; p95 {t.p95}ms
                  {t.failures > 0 && <span className="text-warning-700"> &middot; {t.failures} failed</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
