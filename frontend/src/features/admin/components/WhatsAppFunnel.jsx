import { useQuery } from '@tanstack/react-query'
import { TrendingDown } from 'lucide-react'
import { adminService } from '@services/admin.service'
import { STEP_LABEL, FAILURE_LABEL, QUESTION_WORD } from './whatsappVocab'

// The Funnel tab: how conversations become listings, and where they die.
// Counted in conversations; every rate is against conversations started.

function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-serif font-semibold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function InsightCard({ title, hint, rows, empty }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      <div className="mt-3 space-y-1.5">
        {rows.length ? rows.map((r) => (
          <p key={r.key} className="flex items-center justify-between gap-4 text-sm text-slate-600">
            <span className="truncate">{r.label}</span>
            <span className="font-mono text-slate-700 shrink-0">{r.count}</span>
          </p>
        )) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </div>
  )
}

export default function WhatsAppFunnel({ days, setDays }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-whatsapp-funnel', days],
    queryFn: () => adminService.whatsappFunnel(days).then((r) => r.data),
  })
  if (isLoading || !data) return <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />

  const started = data.steps[0]?.count ?? 0
  // The step-to-step drop is the actionable number — the biggest one is where
  // the flow loses the most people, so it gets named.
  const drops = data.steps.map((s, i) => (i === 0 ? 0 : (data.steps[i - 1].count - s.count)))
  const biggestDrop = Math.max(...drops)
  const failureTotal = data.failures.reduce((n, f) => n + f.count, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">Counted in conversations. Every rate is against conversations started.</p>
        <div className="flex gap-2 shrink-0">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold ${days === d ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Conversations started" value={data.started} sub={data.openNow ? `${data.openNow} open right now` : null} />
        <Stat label="Listings submitted" value={data.listingsCreated} sub={`${data.completionRate}% of started`} />
        <Stat label="Went live" value={data.listingsPublished} />
        <Stat label="Median time to submit" value={data.medianMinutesToSubmit != null ? `${data.medianMinutesToSubmit} min` : '—'} sub={data.sampleSize ? `across ${data.sampleSize} listings` : 'no submissions yet'} />
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Step by step</h3>
        <ol className="space-y-3">
          {data.steps.map((s, i) => {
            const isBiggestDrop = i > 0 && drops[i] === biggestDrop && biggestDrop > 0
            return (
              <li key={s.name}>
                <div className="flex items-center gap-4 text-sm">
                  <span className="w-36 shrink-0 text-slate-600">{STEP_LABEL[s.name] ?? s.name}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full flex items-center transition-all duration-normal" style={{ width: `${started ? Math.max(4, Math.round((s.count / started) * 100)) : 0}%` }}>
                      <span className="text-[11px] font-semibold text-white pl-2">{s.count}</span>
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-slate-700">{s.rate}%</span>
                </div>
                {isBiggestDrop && (
                  <p className="flex items-center gap-1 text-xs text-amber-700 mt-1 ml-40">
                    <TrendingDown size={16} aria-hidden="true" /> Biggest drop — {drops[i]} conversation{drops[i] === 1 ? '' : 's'} lost here
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InsightCard
          title="By property type"
          rows={data.byType.map((t) => ({ key: t.propertyType, label: t.label, count: t.count }))}
          empty="No listings chosen a type yet."
        />
        <InsightCard
          title="Stuck conversations"
          hint="Open, quiet for over a day — grouped by the question they stopped at."
          rows={data.dropOff.slice(0, 6).map((d) => ({ key: d.question, label: QUESTION_WORD[d.question] ?? d.question, count: d.count }))}
          empty="Nobody stuck for over a day."
        />
        <InsightCard
          title={`Failures${failureTotal ? ` · ${failureTotal}` : ''}`}
          hint="What went wrong, counted per event."
          rows={data.failures.filter((f) => f.count > 0).map((f) => ({ key: f.name, label: FAILURE_LABEL[f.name] ?? f.name, count: f.count }))}
          empty="Nothing has failed in this window."
        />
      </div>
    </div>
  )
}
