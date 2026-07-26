import { Link } from 'react-router-dom'
import { ArrowRight, Check, Search } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { toQueryParams } from '@/config/filters'

/* ═══════════════════════════════════════════════════════════
   Bottom overlay on the map: what the current viewport holds,
   and the route out of it into the list.

   Deliberately NOT a second results panel — the map keeps the
   whole surface, and this only reports and hands off.
   ═══════════════════════════════════════════════════════════ */
export default function MapViewportBar() {
  const pins            = useMapStore((s) => s.pins)
  const bounds          = useMapStore((s) => s.bounds)
  const searchOnMove    = useMapStore((s) => s.searchOnMove)
  const setSearchOnMove = useMapStore((s) => s.setSearchOnMove)
  const refetchPins     = useMapStore((s) => s.refetchPins)
  const filters         = useFilterStore((s) => s.filters)

  const count = pins.length

  // "See them as a list" carries the filters AND the viewport, so the grid
  // opens on the same homes the map was showing. Filters alone weren't enough:
  // panning to a neighbourhood is a query too, and dropping it handed the list
  // every matching home in the country instead of the ones just counted.
  const params = new URLSearchParams(
    Object.entries(toQueryParams(filters)).filter(([, v]) => v != null && v !== '')
  )
  if (bounds) {
    params.set('swLat', String(bounds.swLat))
    params.set('swLng', String(bounds.swLng))
    params.set('neLat', String(bounds.neLat))
    params.set('neLng', String(bounds.neLng))
  }
  const query = params.toString()
  const listHref = query ? `/properties?${query}` : '/properties'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4 md:px-5 md:pb-5">
      {/* Three tracks at md+ so the count pill is centred on the MAP, not just
          pushed to the far end by justify-between. The third track stays empty
          on purpose — it is what keeps the middle one centred. */}
      <div className="flex flex-col items-center gap-2 md:grid md:grid-cols-3 md:items-end md:gap-3">
        {/* ── Search-as-I-move, plus the manual escape hatch when it's off ── */}
        <div className="pointer-events-auto order-2 flex flex-wrap items-center gap-2 md:order-1 md:justify-self-start">
          <button
            type="button"
            role="checkbox"
            aria-checked={searchOnMove}
            onClick={() => setSearchOnMove(!searchOnMove)}
            className="flex min-h-[44px] items-center gap-2.5 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span
              aria-hidden="true"
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                searchOnMove
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-transparent'
              }`}
            >
              <Check size={12} strokeWidth={3} />
            </span>
            Search as I move the map
          </button>

          {/* Without this, turning the checkbox off is a dead end — the map
              would pan forever and never update what it's showing. */}
          {!searchOnMove && (
            <button
              type="button"
              onClick={() => refetchPins?.()}
              disabled={!refetchPins}
              className="flex min-h-[44px] items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Search size={14} strokeWidth={2.5} />
              Search this area
            </button>
          )}
        </div>

        {/* ── What's in view, and the way into the list ── */}
        <div className="pointer-events-auto order-1 md:order-2 md:justify-self-center">
          {count > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-4 pr-1 text-white shadow-lg">
              <span className="text-sm">
                <span className="font-mono font-bold">{count}</span>
                <span className="ml-1.5 text-white/70">
                  {count === 1 ? 'home in this view' : 'homes in this view'}
                </span>
              </span>
              <Link
                to={listHref}
                className="ml-1 flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-900 no-underline transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                See them as a list
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          ) : (
            <p className="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white/90 shadow-lg">
              No homes in this view — try zooming out
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
