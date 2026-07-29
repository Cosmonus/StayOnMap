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
    title: 'Search the map, not a feed',
    description:
      'Zoom into the neighbourhood you actually want and every pin is a real rental you can visit. Pan the map and the results follow you.',
    proof: 'Filter by budget, BHK, furnishing, amenities and house rules — then hand the exact view you built to a list.',
  },
  {
    num: '02',
    title: 'Read the area, not just the flat',
    description:
      'The walls are the easy part. We measure what surrounds the address — the metro you would actually walk to, groceries, banks, air quality, even how the ground sits.',
    proof: 'Every figure names its source and how sure we are, and says so plainly when we do not know. No invented walk times.',
  },
  {
    num: '03',
    title: 'Deal with the owner directly',
    description:
      'Message the owner, pick a visit slot that suits you both, and sign the agreement between the two of you. Nobody stands in the middle taking a cut.',
    proof: 'Owners verify ownership documents before a listing goes live, and every listing carries a TrustScore you can see.',
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
function Metric({ value, label, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="font-serif text-4xl font-semibold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  )
}

function Step({ num, title, description, proof }) {
  return (
    <li className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-semibold text-white">
          {num}
        </span>
        <p className="text-base font-semibold leading-snug text-slate-900">{title}</p>
      </div>
      <p className="mt-3.5 text-sm leading-relaxed text-slate-600">{description}</p>
      <p className="mt-auto border-t border-slate-100 pt-3.5 text-xs leading-relaxed text-slate-500">
        {proof}
      </p>
    </li>
  )
}

function Argument({ liveListings, activeOwners, citiesLive, isLoading }) {
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const dash = isLoading ? '—' : null

  return (
    <section className="w-full bg-slate-50/60 px-4 py-14 md:px-6 md:py-20">
      {/* Stacked full-width bands, not two columns. A short left column beside
          a tall right one strands a band of whitespace that reads as a
          rendering failure — the exact fault this page was rebuilt to remove. */}
      {/* Capped only for ultra-wide; at 1440 and below this is the same slim
          gutter the properties grid and footer use, so the bands line up. */}
      <div className="mx-auto max-w-[1600px]">
        {/* ── The claim ── */}
        <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Rent with <span className="text-brand-600">intelligence</span>.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
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
        </div>

        {/* ── The proof: three live numbers, each saying what it means ── */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric
            value={dash ?? liveListings}
            label="Live listings"
            note="Published right now and visible to you — not an all-time total."
          />
          <Metric
            value={dash ?? activeOwners}
            label="Active owners"
            note="Real people who own what they list. No agencies, no brokers."
          />
          <Metric
            value={dash ?? citiesLive}
            label={citiesLive === 1 ? 'City live' : 'Cities live'}
            note="Cities with homes on the map today, counted from the listings themselves."
          />
        </div>

        {/* ── How it works: three steps across, so no column strands space ── */}
        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold leading-tight text-slate-900">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
            Three steps, and a broker in none of them.
          </p>
          <ol className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <Step key={step.num} {...step} />
            ))}
          </ol>
        </div>

        {/* ── Slim closing strip ── */}
        <div className="mt-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Apps coming to iOS &amp; Android.</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Everything here already works in a mobile browser — nothing is waiting on the app.
            </p>
          </div>
          {/* "See how the scoring works" pointed at /intelligence, deleted
              2026-07-30 with the other marketing pages. Not re-pointed at
              anything: the honest explanation of a score lives beside the score
              itself, on the property page's Trust & safety card and the spatial
              panel's provenance chips, which every listing already carries. */}
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

// This block was written when the platform only rented. Buy mode arrived in the
// filters and on the wire, and every word here stayed rent-only — so a plot on
// sale for ₹95L appeared under "Renting right now · Median rent is ₹9,500,000".
// `rent` is the primary price in ALL THREE modes (see PricingModel in
// schema.prisma); only its NAME changes, and it has to.
const MODE_COPY = {
  RENT: {
    heading: 'Renting right now', headingIn: (p) => `Renting in ${p}`,
    median: 'Median rent is', unit: (n) => (n === 1 ? 'home live now' : 'homes live now'),
    nearby: 'Also renting nearby', nearbyFoot: 'Real counts, real links — every one of these opens a list with homes in it.',
    emptyPlace: (p) => `Nothing listed in ${p} yet`,
  },
  LEASE: {
    heading: 'On lease right now', headingIn: (p) => `On lease in ${p}`,
    median: 'Median lease amount is', unit: (n) => (n === 1 ? 'home live now' : 'homes live now'),
    nearby: 'Also on lease nearby', nearbyFoot: 'Real counts, real links — every one of these opens a list with homes in it.',
    emptyPlace: (p) => `Nothing on lease in ${p} yet`,
  },
  SALE: {
    heading: 'For sale right now', headingIn: (p) => `For sale in ${p}`,
    median: 'Median asking price is', unit: (n) => (n === 1 ? 'place for sale' : 'places for sale'),
    nearby: 'Also for sale nearby', nearbyFoot: 'Real counts, real links — every one of these opens a list with places in it.',
    emptyPlace: (p) => `Nothing for sale in ${p} yet`,
  },
}

const modeCopy = (mode) => MODE_COPY[mode] ?? MODE_COPY.RENT

function NearbyCard({ groups, complete, copy, hrefFor }) {
  if (!groups.length) return null
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-800">{copy.nearby}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {groups.map(({ city, count }) => (
          <Link
            key={city}
            to={hrefFor(city)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 no-underline transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {city}
            {/* Counts are only shown when this page holds the whole result
                set. Past that, a number here would be a floor presented as a
                total — the exact overstatement this block exists to avoid. */}
            {complete && <span className="text-slate-500"> · {count}</span>}
          </Link>
        ))}
      </div>
      <p className="mt-auto pt-4 text-xs leading-relaxed text-slate-500">
        {copy.nearbyFoot}
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

  const copy = modeCopy(filters.pricingModel)

  // "See all" and the nearby chips have to carry the mode across, or a buyer
  // browsing sales lands on a page of rentals — the filter is in the URL on
  // /properties, so dropping it here silently changes what they asked for.
  const modeParam = filters.pricingModel && filters.pricingModel !== 'RENT'
    ? `pricingModel=${filters.pricingModel}`
    : ''
  const hrefWith = (extra) => {
    const qs = [extra, modeParam].filter(Boolean).join('&')
    return qs ? `/properties?${qs}` : '/properties'
  }
  const seeAllHref = hrefWith(filters.city ? `city=${encodeURIComponent(filters.city)}` : '')
  const nearbyHref = (city) => hrefWith(`city=${encodeURIComponent(city)}`)

  if (isLoading) {
    return (
      <section className="w-full border-t border-slate-200 bg-white px-4 py-14 md:px-6 md:py-16">
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
      <section className="w-full border-t border-slate-200 bg-white px-4 py-14 md:px-6 md:py-16">
        <h2 className="font-display text-2xl font-bold text-slate-900">{copy.heading}</h2>
        <p className="mt-2 text-sm text-slate-500">
          We couldn&apos;t load listings just now.{' '}
          <Link to={seeAllHref} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
            Browse all listings
          </Link>{' '}
          instead.
        </p>
      </section>
    )
  }

  if (!rows.length) {
    return (
      <section className="w-full border-t border-slate-200 bg-white px-4 py-14 md:px-6 md:py-16">
        <h2 className="font-display text-2xl font-bold text-slate-900">
          {placeName ? copy.emptyPlace(placeName) : 'No listings match those filters yet'}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          {placeName
            ? 'Try widening the map, or be the first to list a place here.'
            : 'Try clearing a filter or two — the map above updates as you go.'}
        </p>
      </section>
    )
  }

  return (
    <section className="w-full border-t border-slate-200 bg-white px-4 py-14 md:px-6 md:py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
            {placeName ? copy.headingIn(placeName) : copy.heading}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {medianRent && (
              <>
                {copy.median}{' '}
                <span className="font-mono font-semibold text-slate-700">{formatCurrency(medianRent)}</span>
                {' '}across{' '}
              </>
            )}
            {!medianRent && 'Showing '}
            <span className="font-semibold text-slate-700">{total}</span>{' '}
            {copy.unit(total)}
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
        <NearbyCard groups={nearby} complete={complete} copy={copy} hrefFor={nearbyHref} />
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
