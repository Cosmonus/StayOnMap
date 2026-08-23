import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { adminService } from '@services/admin.service'

// What people searched for and we could not show them.
//
// The funnel above measures what people DID. This measures what they wanted and
// we did not have — the only readout on this page that points at a specific
// listing to go and find. With inventory as the binding constraint, that makes
// it the most actionable number here.
//
// Two things it deliberately does NOT do:
//   - It never shows an area more precisely than ~5km. The record itself is a
//     geohash-5, so there is nothing finer to show even if we wanted to. The
//     server names the cell's centre ("Velachery, Chennai") since 2026-08-23 —
//     "tggj0" was an area nobody could act on — and the cell stays as a tooltip.
//   - It never renders 0% where the answer is "nobody has searched yet" —
//     the same distinction FunnelCard draws, and for the same reason.
const TYPE_LABELS = {
  APARTMENT: 'Flats', HOUSE: 'Houses', VILLA: 'Villas',
  INDEPENDENT_HOUSE: 'Independent houses', PG: 'PG beds',
  COMMERCIAL: 'Shops', LAND: 'Plots', SHORT_STAY: 'Short stays',
}

/** The ask, as a sentence a person can act on. */
function describe(row) {
  const parts = []
  if (row.bhk) parts.push(`${row.bhk} BHK`)
  parts.push(TYPE_LABELS[row.type] ?? (row.type ? row.type : 'Anything'))
  if (row.rentBand) parts.push(`under ${row.rentBand.split('-').pop()}`)
  if (row.pricingModel && row.pricingModel !== 'RENT') parts.push(`(${row.pricingModel.toLowerCase()})`)
  return parts.join(' ')
}

export default function DemandCard() {
  const [, setSearchParams] = useSearchParams()

  // The one action this readout can honestly offer. It cannot go and source a
  // listing — that is not a thing an admin panel does — but it can answer the
  // question the number immediately raises: is the gap real, and is there a
  // paused or pending listing sitting there that would have matched?
  //
  // The AREA is deliberately not passed. `cellGeohash` is a ~5km cell, which is
  // coarser than the map's own area search, so handing it over as a filter
  // would narrow the view by a boundary that means nothing to a person.
  const showWhatWeHave = (row) => {
    const params = { tab: 'admin-properties' }
    if (row.city) params.city = row.city
    if (row.type) params.type = row.type
    if (row.bhk != null) params.bhk = String(row.bhk)
    setSearchParams(params)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-demand'],
    queryFn: () => adminService.demand().then((r) => r.data),
  })

  if (isLoading) {
    return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Could not load search demand.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    )
  }

  const unmet = data?.unmet ?? []
  const nothingRecorded = (data?.searches ?? 0) === 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-sm font-bold text-slate-900">Unmet search demand</h2>
        <span className="text-xs text-slate-500 shrink-0">last {data?.days ?? 30} days</span>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Searches that returned nothing. Areas are ~5km cells and no search is tied to a
        person &mdash; this counts asks, not askers.
      </p>

      {nothingRecorded ? (
        <p className="text-sm text-slate-600 py-6">
          No searches recorded yet. This fills in as people use the map &mdash; it is not
          a claim that every search succeeded.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-5">
            <span className="font-serif text-4xl text-slate-900">
              {data.zeroResultRate}%
            </span>
            <span className="text-xs text-slate-500">
              of {data.searches.toLocaleString('en-IN')} searches found nothing
            </span>
          </div>

          {unmet.length === 0 ? (
            <p className="text-sm text-slate-600 py-2">
              Every recorded search returned at least one listing.
            </p>
          ) : (
            <>
            <ul className="flex flex-col divide-y divide-slate-100">
              {unmet.map((row) => (
                <li key={`${row.cellGeohash}-${row.type}-${row.bhk}-${row.rentBand}`}>
                  <button
                    type="button"
                    onClick={() => showWhatWeHave(row)}
                    className="w-full min-h-[44px] flex items-baseline justify-between gap-3 py-3 px-2 -mx-2 rounded-lg text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span className="text-sm text-slate-800">
                      {describe(row)}
                      <span className="text-slate-500" title={`~5km cell ${row.cellGeohash}`}>
                        {' '}&middot; {[row.area, row.city].filter(Boolean).join(', ')
                          || <span className="font-mono text-xs">cell {row.cellGeohash}</span>}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      <span className="font-mono font-semibold text-slate-800">
                        {row.zeroResults}
                      </span>{' '}
                      empty
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
              Open a row to see what we DO have there. Sourcing the gap is not something
              this panel can do &mdash; but confirming it is real, and spotting a paused or
              pending listing that would have matched, is.
            </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
