import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import MapView from '@features/map/components/MapView'
import MapLegend from '@features/map/components/MapLegend'
import AreaInsightCard from '@features/map/components/AreaInsightCard'
import MapRightPanel from '@features/map/components/MapRightPanel'
import MapViewportBar from '@features/map/components/MapViewportBar'
import PropertyCard from '@features/properties/components/PropertyCard'
import SEOMeta from '@components/common/SEOMeta'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { useUiStore } from '@store/uiStore'
import { useAuth } from '@features/auth/hooks/useAuth'
import { BRAND, canonical } from '@lib/seo'
import { usePlatformStats } from '@hooks/usePlatformStats'
import { toQueryParams } from '@/config/filters'
import { useFilterUrlSync } from '@features/filters/hooks/useFilterUrlSync'
import { formatCurrency } from '@utils/format'

// The header is two stacked rows and is position-fixed, so the page below it
// starts at its full height. Kept as one constant per breakpoint so the map
// and the padding can never disagree and leave a seam or a scrollbar.
const HEADER_OFFSET = 'pt-[132px] md:pt-[166px]'
const BELOW_HEADER_H = 'h-[calc(100vh-132px)] md:h-[calc(100vh-166px)]'

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    title: 'Search the map',
    description: 'Zoom into the neighbourhood you actually want. Every pin is a real, verified rental.',
  },
  {
    num: '02',
    title: 'Read the area, not just the flat',
    description: 'Commute, groceries, drainage and air for that exact address — with our confidence stated.',
  },
  {
    num: '03',
    title: 'Book a visit with the owner',
    description: 'Pick a slot, message them directly, sign directly. No broker takes a month\'s rent.',
  },
]

/* ================================================================
   ABOVE THE FOLD — the map is the whole surface. No split, no
   panel stealing 40% of it; the argument lives below instead.
   ================================================================ */
function MapSurface() {
  return (
    <section className={`w-full ${HEADER_OFFSET}`}>
      <div className={`relative w-full ${BELOW_HEADER_H} min-h-[420px] border-b border-slate-200`}>
        {/* `contained` keeps gestureHandling cooperative — a greedy map inside
            a page that scrolls traps mobile users with no way past it. */}
        <MapView contained />
        <MapLegend />
        <AreaInsightCard />
        <MapRightPanel contained topClass="top-4" />
        <MapViewportBar />
      </div>
    </section>
  )
}

/* ================================================================
   THE ARGUMENT — what's actually differentiated, three live
   numbers, three steps, one CTA.
   ================================================================ */
function Metric({ value, label }) {
  return (
    <div>
      <p className="font-serif text-4xl font-semibold leading-none text-slate-900">{value}</p>
      <p className="mt-1.5 text-sm text-slate-500">{label}</p>
    </div>
  )
}

function Step({ num, title, description }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-slate-400">{num}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </li>
  )
}

function Argument({ liveListings, activeOwners, citiesLive, isLoading }) {
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const dash = isLoading ? '—' : null

  return (
    <section className="w-full px-4 py-14 md:px-6 md:py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        {/* ── Left: the claim, the proof, the CTA ── */}
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Rent with <span className="text-brand-600">intelligence</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Every home on the map carries a live TrustScore, and we tell you what&apos;s around the
            address — metro, groceries, drainage, air — with the confidence to say when we
            don&apos;t know. No brokers, no brokerage.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              onClick={openLoginModal}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              List your property free
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
            <Link
              to="/rules"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              How we verify owners
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
            <Metric value={dash ?? liveListings} label="Live listings" />
            <Metric value={dash ?? activeOwners} label="Active owners" />
            <Metric value={dash ?? citiesLive} label={citiesLive === 1 ? 'City live' : 'Cities live'} />
          </div>
        </div>

        {/* ── Right: how it works, then the app waitlist ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">How it works</p>
          <ol className="mt-5 flex flex-col gap-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <Step key={step.num} {...step} />
            ))}
          </ol>

          <div className="mt-9 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-800">Apps coming to iOS &amp; Android.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              The live map, TrustScores and owner chat, in your pocket. Everything on this site
              works in a mobile browser today — nothing is waiting on the app.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
   RENTING HERE — real listings and real nearby counts. This block
   replaces the dashed "coming soon" placeholders: a card that can't
   be clicked is a dead end, a real locality link converts.
   ================================================================ */
function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function NearbyCard({ groups, complete }) {
  if (!groups.length) return null
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-800">Also renting nearby</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {groups.map(({ city, count }) => (
          <Link
            key={city}
            to={`/properties?city=${encodeURIComponent(city)}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 no-underline transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {city}
            {/* Counts are only shown when this page holds the whole result
                set. Past that, a number here would be a floor presented as a
                total — the exact overstatement this block exists to avoid. */}
            {complete && <span className="text-slate-400"> · {count}</span>}
          </Link>
        ))}
      </div>
      <p className="mt-auto pt-4 text-xs leading-relaxed text-slate-500">
        Real counts, real links — every one of these opens a list with homes in it.
      </p>
    </div>
  )
}

function RentingHere() {
  const filters = useFilterStore((s) => s.filters)
  const searchedPlace = useMapStore((s) => s.searchedPlace)
  const params = toQueryParams(filters)

  // One request powers the whole block: the cards, the median and the nearby
  // counts. Grouping client-side beats four round trips for four numbers.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-renting-here', params],
    queryFn: () => propertyService.getList({ limit: 50, ...params }),
    staleTime: 5 * 60 * 1000,
  })

  const rows = data?.data ?? []
  const total = data?.meta?.total ?? rows.length
  // True when this page holds every match, which is what makes the grouped
  // per-city counts below exact rather than a lower bound.
  const complete = rows.length >= total

  const placeName = searchedPlace?.name || filters.city || null
  const medianRent = median(rows.map((r) => Number(r.rent)).filter((n) => Number.isFinite(n) && n > 0))

  const currentCity = (filters.city || '').toLowerCase()
  const nearby = Object.entries(
    rows.reduce((acc, r) => {
      if (!r.city || r.city.toLowerCase() === currentCity) return acc
      acc[r.city] = (acc[r.city] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const seeAllHref = filters.city ? `/properties?city=${encodeURIComponent(filters.city)}` : '/properties'

  if (isLoading) {
    return (
      <section className="w-full border-t border-slate-200 bg-slate-50/60 px-4 py-14 md:px-6 md:py-16">
        <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="w-full border-t border-slate-200 bg-slate-50/60 px-4 py-14 md:px-6 md:py-16">
        <h2 className="font-display text-2xl font-bold text-slate-900">Renting right now</h2>
        <p className="mt-2 text-sm text-slate-500">
          We couldn&apos;t load listings just now.{' '}
          <Link to="/properties" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
            Browse all rentals
          </Link>{' '}
          instead.
        </p>
      </section>
    )
  }

  if (!rows.length) {
    return (
      <section className="w-full border-t border-slate-200 bg-slate-50/60 px-4 py-14 md:px-6 md:py-16">
        <h2 className="font-display text-2xl font-bold text-slate-900">
          {placeName ? `Nothing listed in ${placeName} yet` : 'No listings match those filters yet'}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {placeName
            ? 'Try widening the map, or be the first to list a home here.'
            : 'Try clearing a filter or two — the map above updates as you go.'}
        </p>
      </section>
    )
  }

  return (
    <section className="w-full border-t border-slate-200 bg-slate-50/60 px-4 py-14 md:px-6 md:py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
            {placeName ? `Renting in ${placeName}` : 'Renting right now'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {medianRent && (
              <>
                Median rent is{' '}
                <span className="font-mono font-semibold text-slate-700">{formatCurrency(medianRent)}</span>
                {' '}across{' '}
              </>
            )}
            {!medianRent && 'Showing '}
            <span className="font-semibold text-slate-700">{total}</span>{' '}
            {total === 1 ? 'home live now' : 'homes live now'}
          </p>
        </div>
        <Link
          to={seeAllHref}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start text-sm font-semibold text-brand-700 no-underline underline-offset-4 hover:underline sm:self-auto"
        >
          See all {total}
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>

      {/* auto-fill so the row never leaves a half-width orphan card, and never
          pads itself out with placeholders that go nowhere. */}
      <div className="mt-8 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {rows.slice(0, 3).map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
        <NearbyCard groups={nearby} complete={complete} />
      </div>
    </section>
  )
}

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `${BRAND.name} — ${BRAND.tagline}`,
  url: canonical('/'),
  description:
    'Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India.',
}

export default function HomePage() {
  const { user } = useAuth()
  useFilterUrlSync()

  const filters = useFilterStore((s) => s.filters)
  const { activeOwners, isLoading: statsLoading } = usePlatformStats()

  // Live listings and cities come from the LIST endpoint, not /stats: the list
  // applies the owner-visibility filter, so its total is what a visitor can
  // actually browse. /stats counts HIDDEN and LOGGED_IN-only listings too and
  // reads high — see the note in the PR. activeOwners still comes from /stats
  // because ownerId is never returned on a public list response.
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['home-visible-totals', toQueryParams(filters)],
    queryFn: () => propertyService.getList({ limit: 50 }),
    staleTime: 5 * 60 * 1000,
  })
  const rows = listData?.data ?? []
  const liveListings = listData?.meta?.total ?? 0
  const citiesLive = new Set(rows.map((r) => r.city).filter(Boolean)).size

  return (
    <div className="overflow-x-hidden bg-white">
      <SEOMeta
        description="Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India."
        canonical={canonical('/')}
        jsonLd={HOME_JSON_LD}
      />
      <MapSurface />
      {!user && (
        <Argument
          liveListings={liveListings}
          activeOwners={activeOwners}
          citiesLive={citiesLive}
          isLoading={listLoading || statsLoading}
        />
      )}
      <RentingHere />
    </div>
  )
}
