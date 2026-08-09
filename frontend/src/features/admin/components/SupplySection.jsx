import { useQuery } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

// The supply side, and the handshake.
//
// Everything else in this panel measures renters: the funnel counts what they
// did, unmet demand counts what they asked for. A marketplace with ~5 genuine
// listings does not have a demand problem, and none of those screens could say
// so. This one answers the other three questions — do listings get finished, do
// owners answer, and does any of it end in a tenancy.
//
// One query, four readouts, because they are one screen. Every number here is a
// COUNT or a MEDIAN and never a rate: at this inventory a percentage moves ten
// points when one person books, which reads as a trend and is a rounding error.

const STEP_LABELS = {
  type: 'Choosing a category',
  basics: 'Basics',
  location: 'Location',
  photos: 'Photos',
  features: 'Features',
  price: 'Price',
  review: 'Review & publish',
  unknown: 'Unknown step',
}

function Card({ title, hint, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {right && <span className="text-xs text-slate-500 shrink-0">{right}</span>}
      </div>
      {hint && <p className="text-xs text-slate-500 mb-5">{hint}</p>}
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-sm text-slate-600 py-6">{children}</p>
}

/** A labelled row with a count and a proportional bar. */
function BarRow({ label, count, max }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="font-mono font-semibold text-sm text-slate-800 shrink-0">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-slow"
          style={{ width: `${max ? (count / max) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}

function DraftFunnel({ drafts }) {
  const max = Math.max(1, ...drafts.byStep.map((s) => s.count))
  return (
    <Card
      title="Unfinished listings"
      right={`${drafts.open} open`}
      hint="Where owners stopped. Not an abandonment rate — a draft is deleted the moment it publishes, so finished ones leave no trace to divide by."
    >
      {drafts.open === 0 ? (
        <Empty>Nobody has a listing half-written right now.</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {drafts.byStep.map((s) => (
              <BarRow key={s.stepKey} label={STEP_LABELS[s.stepKey] ?? s.stepKey} count={s.count} max={max} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-5 pt-4 border-t border-slate-100">
            {drafts.stale} untouched for over {drafts.staleDays} days
            {drafts.medianAgeHours != null && <> &middot; median age <span className="font-mono font-semibold text-slate-800">{drafts.medianAgeHours}h</span></>}
          </p>
        </>
      )}
    </Card>
  )
}

function Responsiveness({ responsiveness: r }) {
  return (
    <Card
      title="Owner reply time"
      right={`last ${r.days} days`}
      hint="From a renter's first message to the owner's first answer. Conversations still waiting are counted as unanswered, never dropped."
    >
      {r.conversations === 0 ? (
        <Empty>No renter has messaged an owner yet.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-slate-900 font-mono">
              {r.medianMinutes == null ? '—' : `${r.medianMinutes}m`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">median reply</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 font-mono">
              {r.p90Minutes == null ? '—' : `${r.p90Minutes}m`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">slowest 10%</p>
          </div>
          <div className="col-span-2 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-800">
              <span className="font-mono font-semibold">{r.neverAnswered}</span> of{' '}
              <span className="font-mono font-semibold">{r.conversations}</span> never answered
            </p>
            <p className="text-xs text-slate-500 mt-1">
              The number that decides whether this works. A good median hides the owners who
              never reply at all.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function MatchChain({ chain }) {
  const top = chain.steps[0]?.count ?? 0
  return (
    <Card
      title="Conversation to tenancy"
      right={`last ${chain.days} days`}
      hint="Counted in rows, not sessions — each step counts things STARTED in this window, so a later step can never outgrow the one above it."
    >
      {top === 0 ? (
        <Empty>Nothing has started yet in this window.</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {chain.steps.map((s) => (
              <BarRow key={s.key} label={s.label} count={s.count} max={top} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-5 pt-4 border-t border-slate-100">
            {chain.medianDaysToLease == null ? (
              <>No lease has been signed off the back of a visit yet.</>
            ) : (
              <>
                Median{' '}
                <span className="font-mono font-semibold text-slate-800">{chain.medianDaysToLease} days</span>{' '}
                from visit request to signed lease, across {chain.samples} lease
                {chain.samples === 1 ? '' : 's'}.
              </>
            )}
          </p>
        </>
      )}
    </Card>
  )
}

function SupplyTrend({ supply }) {
  const max = Math.max(1, ...supply.series.map((w) => Math.max(w.created, w.published)))
  return (
    <Card
      title="New listings by week"
      right={`last ${supply.weeks} weeks`}
      hint="Two lines on purpose: started is when an owner began typing, live is when a renter could first see it."
    >
      {supply.series.length === 0 ? (
        <Empty>No listings created in this window.</Empty>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-32">
            {supply.series.map((w) => (
              <div key={w.week} className="flex-1 flex flex-col justify-end gap-0.5" title={`${w.week}: ${w.created} started, ${w.published} live`}>
                <div className="rounded-t bg-brand-500" style={{ height: `${(w.created / max) * 100}%` }} />
                <div className="rounded-b bg-slate-300" style={{ height: `${(w.published / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <span className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-3 h-3 rounded bg-brand-500" aria-hidden="true" /> started
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-3 h-3 rounded bg-slate-300" aria-hidden="true" /> went live
            </span>
          </div>
          {/* Said out loud rather than left as a flat line somebody reads as
              "we published nothing before August". */}
          <p className="text-xs text-slate-500 mt-3">
            Going-live dates are only recorded from {supply.publishedTrackedSince}. Listings live
            before then are counted as started, never as live.
          </p>
        </>
      )}
    </Card>
  )
}

export default function SupplySection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-marketplace'],
    queryFn: () => adminService.marketplace().then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Could not load supply metrics.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SupplyTrend supply={data.supply} />
      <DraftFunnel drafts={data.drafts} />
      <Responsiveness responsiveness={data.responsiveness} />
      <MatchChain chain={data.chain} />
    </div>
  )
}
