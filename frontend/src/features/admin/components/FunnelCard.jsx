import { useQuery } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

// The readout. Data with no readout is a table, not instrumentation — this is
// the whole reason the ingest exists, so it ships in the same change.
//
// Two things it deliberately does NOT do:
//   - It never shows a step-to-step rate. Every percentage is against the top
//     of the funnel, because "50% of people who tapped a pin opened it" hides
//     that only four people tapped anything.
//   - It never renders 0% where the answer is "nobody has visited yet". With
//     ~5 listings in production that distinction is the difference between a
//     product problem and an empty week.
const STEP_LABELS = {
  map_view:            'Saw the map',
  pin_tap:             'Tapped a pin',
  property_view:       'Opened a listing',
  contact_intent:      'Tried to contact',
  appointment_created: 'Booked a visit',
}

function Bar({ pct }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-slow"
        style={{ width: `${pct ?? 0}%` }}
      />
    </div>
  )
}

// One funnel's steps. Extracted so the sitewide and organic funnels are
// rendered by the same code — two copies would be free to drift, and the whole
// point of showing them together is that they are directly comparable.
function StepList({ steps }) {
  return (
    <div className="flex flex-col gap-4">
      {steps.map((step) => (
        <div key={step.name}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm font-medium text-slate-800">
              {STEP_LABELS[step.name] ?? step.name}
            </span>
            <span className="text-xs text-slate-500 shrink-0">
              <span className="font-mono font-semibold text-slate-800">{step.sessions}</span>
              {step.pctOfTop != null && <> &middot; {step.pctOfTop}%</>}
            </span>
          </div>
          <Bar pct={step.pctOfTop} />
        </div>
      ))}
    </div>
  )
}

export default function FunnelCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-funnel'],
    queryFn: () => adminService.funnel().then((r) => r.data),
  })

  if (isLoading) {
    return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Could not load the funnel.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const steps = data?.funnel?.steps ?? []
  const seo = data?.seoFunnel
  const ttp = data?.timeToPublish
  const noData = steps[0]?.sessions === 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-sm font-bold text-slate-900">Renter funnel</h2>
        <span className="text-xs text-slate-500 shrink-0">last {data?.funnel?.days ?? 30} days</span>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Counted in sessions, not taps &mdash; one visitor tapping forty pins is one person.
        Every rate is against the top of the funnel.
      </p>

      {noData ? (
        <p className="text-sm text-slate-600 py-6">
          No sessions recorded yet. This fills in as people use the site &mdash; it is not a
          zero conversion rate.
        </p>
      ) : (
        <StepList steps={steps} />
      )}

      {/* Organic traffic, as its own funnel rather than a filter on the one
          above. Shown ALONGSIDE, never instead: the number worth knowing is the
          DIFFERENCE — whether someone who arrived from a search landing page
          converts better or worse than everyone else — and a reader seeing only
          one of them cannot tell.

          Its percentages are against a DIFFERENT denominator, which is why the
          heading says so out loud. A session that landed on /rent/chennai and
          clicked straight to a listing may never fire `map_view` at all, so
          measuring it against that would produce rates above 100%. */}
      {!noData && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="text-sm font-bold text-slate-900">Landed from search</h3>
            <span className="text-xs text-slate-500 shrink-0 font-mono">{seo?.top ?? 0}</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Sessions that started on a city or area page. Rates are against that arrival,
            not the map.
          </p>

          {seo?.top ? (
            <StepList steps={seo.steps} />
          ) : (
            <p className="text-sm text-slate-600 py-2">
              No search landings recorded yet. This stays empty until the locality and city
              pages are indexed &mdash; it is not a zero conversion rate.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-800">Time to publish a listing</p>
        {ttp?.medianMinutes == null ? (
          <p className="text-xs text-slate-500 mt-1">
            No listings published in the last {ttp?.days ?? 90} days.
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-1">
            Median{' '}
            <span className="font-mono font-semibold text-slate-800">{ttp.medianMinutes} min</span>
            {' '}across {ttp.samples} listing{ttp.samples === 1 ? '' : 's'} &mdash; median, not
            average, so one abandoned draft cannot skew it.
          </p>
        )}
      </div>
    </div>
  )
}
