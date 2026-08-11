import { useQuery } from '@tanstack/react-query'
import { MapPin, ShieldCheck, ShieldAlert, Clock, GitCompareArrows } from 'lucide-react'
import { adminService } from '@services/admin.service'

// POI accuracy as counts, not claims.
//
// The rule this card is built around: "never scored" is never folded into "low
// confidence". Before the scoring job runs every row is unscored, and a card
// that reported that as 0% high-confidence would describe a job that has not
// started as a database full of bad data. Every rate here is quoted against
// SCORED rows, and the unscored count is shown on its own.
//
// Read-only. Nothing here triggers a recompute — a dashboard that started the
// work it reports on would make its own numbers move as you read them.

function Stat({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-500',
    brand: 'text-brand-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={tones[tone]} aria-hidden="true" />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      {/* A dash, not a zero. "We could not measure this" and "this is zero" are
          the distinction the whole layer exists to keep. */}
      <p className="text-2xl font-semibold text-slate-800 font-mono">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function OverdueRow({ row }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="py-2 pr-4 text-slate-800">{row.category}</td>
      <td className="py-2 pr-4 text-right font-mono text-slate-600">{row.count}</td>
      <td className="py-2 pr-4 text-right font-mono text-slate-600">
        {row.oldestFetchDays == null ? '—' : `${row.oldestFetchDays}d`}
      </td>
      <td className="py-2 text-right font-mono text-slate-500">{row.refreshDays}d</td>
    </tr>
  )
}

export default function PoiQualityCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'poi-quality'],
    queryFn: () => adminService.getPoiQuality().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="bg-slate-100 animate-pulse rounded-2xl h-64" />
  }
  // The service returns null when it could not measure. Rendering zeroes there
  // would be a confident wrong answer about our own data quality, on the card
  // whose entire job is not doing that.
  if (isError || !data) {
    return (
      <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-1">POI data quality</h3>
        <p className="text-sm text-slate-500">
          These figures could not be measured just now. Nothing is implied about the data itself.
        </p>
      </section>
    )
  }

  const { headline, freshness, conflicts, churn, byCity, thresholds } = data
  const overdue = freshness.filter((f) => f.overdue).slice(0, 8)

  return (
    <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">POI data quality</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Measured from the index itself. Rates are quoted against scored rows only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat
          icon={MapPin} label="Active places" value={headline.active?.toLocaleString('en-IN')}
          sub={headline.absent ? `${headline.absent.toLocaleString('en-IN')} no longer in map data` : 'none marked absent'}
        />
        <Stat
          icon={ShieldCheck} tone="brand" label="High confidence"
          value={headline.highConfidencePct == null ? null : `${headline.highConfidencePct}%`}
          sub={`of ${headline.scored.toLocaleString('en-IN')} scored (≥${thresholds.high})`}
        />
        <Stat
          icon={Clock} tone={headline.unscored ? 'amber' : 'slate'} label="Never scored"
          value={headline.unscored?.toLocaleString('en-IN')}
          // Stated plainly, because this is the number most likely to be
          // misread as a quality problem when it is a coverage one.
          sub="not a quality signal — just not measured yet"
        />
        <Stat
          icon={ShieldAlert} tone={headline.contradicted ? 'red' : 'slate'} label="Contradicted"
          value={headline.contradicted?.toLocaleString('en-IN')}
          sub={`${headline.verified.toLocaleString('en-IN')} corroborated by India Post`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">Overdue for a re-fetch</h4>
          {/* Against each category's OWN cadence, not one global age. A metro
              station at 200 days is fine; a salon at 200 days is fiction. */}
          {overdue.length === 0 ? (
            <p className="text-sm text-slate-500">Every category is inside its own refresh window.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 text-left">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium text-right">Rows</th>
                  <th className="pb-2 font-medium text-right">Oldest</th>
                  <th className="pb-2 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody>{overdue.map((r) => <OverdueRow key={r.category} row={r} />)}</tbody>
            </table>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">Disagreements</h4>
          <div className="space-y-2">
            {Object.entries(conflicts).length === 0 && (
              <p className="text-sm text-slate-500">Nothing recorded yet.</p>
            )}
            {Object.entries(conflicts).map(([attribute, c]) => (
              <div key={attribute} className="flex items-center justify-between text-sm">
                <span className="text-slate-800">{attribute}</span>
                <span className="font-mono text-slate-600">
                  {c.total} total · {c.open} open
                  {/* The sharpest signal here: we are knowingly serving
                      something the source disputes. */}
                  {c.withheld > 0 && <span className="text-amber-600"> · {c.withheld} withheld</span>}
                </span>
              </div>
            ))}
          </div>

          <h4 className="text-sm font-semibold text-slate-800 mt-5 mb-2">Churn (90 days)</h4>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <GitCompareArrows size={14} aria-hidden="true" />
              {/* Never summed. A place disappearing and a place returning are
                  opposite events with opposite causes. */}
              <span className="font-mono">{churn.wentAbsent}</span> left map data
            </span>
            <span className="text-slate-600">
              <span className="font-mono">{churn.returned}</span> returned
            </span>
          </div>
        </div>
      </div>

      {byCity.length > 1 && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-800 mb-2">By city</h4>
          <div className="flex flex-wrap gap-2">
            {byCity.map((c) => (
              <span key={c.city} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-1.5 text-sm">
                <span className="text-slate-800">{c.city}</span>
                <span className="font-mono text-slate-500">{c.active.toLocaleString('en-IN')}</span>
                {/* An average is the wrong summary for one POI and the right
                    one for comparing cities — the question here is comparative. */}
                <span className="font-mono text-brand-700">{c.avgTrust ?? '—'}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
