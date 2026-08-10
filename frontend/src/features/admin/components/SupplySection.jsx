import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
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

/**
 * A named listing that opens.
 *
 * Both "worst" lists named a listing and left you to find it by hand — the
 * readout identified the problem and then stopped one click short of the thing
 * you would do about it. That is the shape this whole panel was audited for on
 * 2026-08-10: a metric that describes without offering.
 *
 * `?tab=review-listings&propertyId=` is the deep link ReviewListingsSection
 * already reads (`deepLinkId`), and the same one the user-detail and reviews
 * sections use — so this adds a caller, not a mechanism.
 */
function ListingLink({ id, title, right, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="w-full min-h-[44px] flex items-baseline justify-between gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="text-sm text-slate-800 truncate">{title}</span>
        <span className="text-xs text-slate-500 shrink-0">{right}</span>
      </button>
    </li>
  )
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
  const max = Math.max(1, ...supply.series.map((w) => Math.max(w.created, w.published, w.left ?? 0)))
  const netTotal = supply.series.reduce((n, w) => n + (w.net ?? 0), 0)
  return (
    <Card
      title="New listings by week"
      right={`last ${supply.weeks} weeks`}
      hint="Three bars on purpose: started is when an owner began typing, live is when a renter could first see it, and left is a listing rented, paused or removed."
    >
      {supply.series.length === 0 ? (
        <Empty>No listings created in this window.</Empty>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-32">
            {supply.series.map((w) => (
              <div
                key={w.week}
                className="flex-1 flex flex-col justify-end gap-0.5"
                title={`${w.week}: ${w.created} started, ${w.published} live, ${w.left ?? 0} left — net ${w.net >= 0 ? '+' : ''}${w.net ?? 0}`}
              >
                <div className="rounded-t bg-brand-500" style={{ height: `${(w.created / max) * 100}%` }} />
                <div className="bg-slate-300" style={{ height: `${(w.published / max) * 100}%` }} />
                <div className="rounded-b bg-red-300" style={{ height: `${((w.left ?? 0) / max) * 100}%` }} />
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
            <span className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-3 h-3 rounded bg-red-300" aria-hidden="true" /> left the market
            </span>
          </div>
          {/* Net alongside its parts, never instead of them: zero from 8 in and
              8 out is a different business from zero from nothing happening. */}
          <p className="text-sm text-slate-800 mt-4">
            Net <span className="font-mono font-semibold">{netTotal >= 0 ? '+' : ''}{netTotal}</span> live
            listings over {supply.weeks} weeks
          </p>
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

function DeadInventory({ dead, onOpenListing }) {
  return (
    <Card
      title="Listings nobody is looking at"
      right={`last ${dead.days} days`}
      hint="Split rather than summed, because the two need opposite work: no views is a visibility problem, views with no messages is a listing problem."
    >
      {dead.live === 0 ? (
        <Empty>No live listings.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-slate-900 font-mono">{dead.unseen}</p>
              <p className="text-xs text-slate-500 mt-0.5">never opened &mdash; visibility</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-mono">{dead.seenButUncontacted}</p>
              <p className="text-xs text-slate-500 mt-0.5">seen, never messaged &mdash; the listing</p>
            </div>
          </div>
          {dead.worst.length > 0 && (
            <ul className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-1">
              {dead.worst.map((p) => (
                <ListingLink key={p.id} id={p.id} title={p.title} right={`${p.views} views`} onOpen={onOpenListing} />
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-4">
            Oldest first &mdash; a listing ignored for a month is a more urgent conversation with
            its owner than one posted on Tuesday.
          </p>
        </>
      )}
    </Card>
  )
}

function Readiness({ readiness: r, onOpenListing }) {
  return (
    <Card
      title="Are the listings good enough"
      right={`${r.live} live`}
      hint="Buckets, not an average — '2.4 photos' describes no real listing, and the fact worth acting on is how many sit at zero."
    >
      {r.live === 0 ? (
        <Empty>No live listings.</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <BarRow label="No photos at all" count={r.photos.none} max={r.live} />
            <BarRow label="One or two photos" count={r.photos.few} max={r.live} />
            <BarRow label="Three or more" count={r.photos.enough} max={r.live} />
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-mono font-semibold text-slate-800">{r.noDescription}</p>
              <p className="text-xs text-slate-500">thin or missing description</p>
            </div>
            <div>
              <p className="text-sm font-mono font-semibold text-slate-800">{r.verified}</p>
              <p className="text-xs text-slate-500">ownership verified</p>
            </div>
          </div>
          {/* getListingReadiness has always returned `worst`; only the buckets
              were rendered. The buckets say how big the problem is, this says
              WHICH listings it is — the only half an operator can act on, and
              at ~13 listings it is a list you can work through in an afternoon.
              Deliberately NOT linked into review-listings: these are LIVE
              listings and that tab queues PENDING ones, so the link would land
              on a page that cannot show them. */}
          {r.worst?.length > 0 && (
            <ul className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-1">
              {r.worst.map((p) => (
                <ListingLink
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  right={`${p.photos === 0 ? 'no photos' : `${p.photos} photo${p.photos === 1 ? '' : 's'}`}${p.thinDescription ? ' · thin copy' : ''}`}
                  onOpen={onOpenListing}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

// Three windows, not a free-form date range. Each is a different question —
// "is something wrong today", "how is this month going", "is the trend real" —
// and a picker offering 43 days invites reading noise as signal at an inventory
// this small.
const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

function WindowPicker({ days, onPick }) {
  return (
    <div className="flex items-center gap-2 mb-5" role="group" aria-label="Time window">
      {WINDOWS.map((w) => (
        <button
          key={w.days}
          type="button"
          onClick={() => onPick(w.days)}
          aria-pressed={days === w.days}
          className={[
            'min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold border transition-all',
            days === w.days
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
          ].join(' ')}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}

export default function SupplySection() {
  const [days, setDays] = useState(30)
  const [, setSearchParams] = useSearchParams()

  // Opens a named listing in the moderation view. The same deep link
  // ReviewListingsSection already reads, and the same one the user-detail and
  // reviews sections use — a caller, not a new mechanism.
  const onOpenListing = (id) => setSearchParams({ tab: 'review-listings', propertyId: id })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-marketplace', days],
    queryFn: () => adminService.marketplace({ days }).then((r) => r.data),
    // The cards stay on screen while a new window loads. Without this the whole
    // panel flips to skeletons on every click, which reads as slower than it is
    // and loses the number you were comparing against.
    placeholderData: keepPreviousData,
  })

  // The picker renders in EVERY state, including the first load and the error.
  // A control that appears only on success means the one moment you most want
  // to try a different window — the screen is empty and you are wondering
  // whether that is real — is the moment it is not there.
  if (isLoading) {
    return (
      <>
        <WindowPicker days={days} onPick={setDays} />
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </>
    )
  }

  if (isError) {
    return (
      <>
      <WindowPicker days={days} onPick={setDays} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Could not load supply metrics.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
      </>
    )
  }

  return (
    <>
      <WindowPicker days={days} onPick={setDays} />
      <div className="grid gap-5 lg:grid-cols-2">
      <SupplyTrend supply={data.supply} />
      <DraftFunnel drafts={data.drafts} />
      <Responsiveness responsiveness={data.responsiveness} />
      <MatchChain chain={data.chain} />
      <DeadInventory dead={data.dead} onOpenListing={onOpenListing} />
      <Readiness readiness={data.readiness} onOpenListing={onOpenListing} />
      </div>
    </>
  )
}
