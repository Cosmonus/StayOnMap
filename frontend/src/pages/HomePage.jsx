import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, PartyPopper, Rocket, Sparkles } from 'lucide-react'
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
import { BRAND, canonical, PLAY_STORE_URL, WHATSAPP_LIST_URL } from '@lib/seo'
import { usePlatformStats } from '@hooks/usePlatformStats'
import { toQueryParams } from '@/config/filters'
import { useFilterUrlSync } from '@features/filters/hooks/useFilterUrlSync'
import { formatCurrency } from '@utils/format'

// The header is two stacked rows and is position-fixed, so the page below it
// starts at its full height. That height is MEASURED and published as
// --header-h by Header.jsx — these were `pt-[132px] md:pt-[166px]` against a
// header that is really 134/142, which is where the band between the filter bar
// and the map came from. A per-breakpoint constant cannot track a control
// that gets resized in a different file.
const HEADER_OFFSET = 'pt-[var(--header-h)]'
const BELOW_HEADER_H = 'h-[calc(100vh-var(--header-h))]'

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
        {/* ── The claim — full width, so the simplicity pitch gets room ── */}
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Rent with <span className="text-brand-600">intelligence</span>.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Every home on the map carries a live TrustScore, and we tell you what&apos;s around the
            address — metro, groceries, drainage, air — with the confidence to say when we
            don&apos;t know. No brokers, no brokerage.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            And we kept everything simple — you can now list your property on{' '}
            <span className="font-semibold text-slate-800">WhatsApp</span> too. No app to
            install, no forms to fight: just chat with us, answer a few questions about your
            place in your own words, drop a location pin and send your photos. Hosting a
            property takes as little as{' '}
            <span className="font-semibold text-slate-800">5 minutes</span>, and your phone
            number is all the sign-up you need.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              onClick={openLoginModal}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              List your property free
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
            <a
              href={WHATSAPP_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 no-underline transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <WhatsAppIcon />
              List your property on WhatsApp
            </a>
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

        {/* ── Launch card: the Android app is live, and we say so loudly.
            Dark jade so it reads as the one celebratory moment on a page of
            white cards; the blobs are decorative and aria-hidden. ── */}
        <div className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 bg-[length:200%_200%] px-6 py-8 text-white shadow-lg motion-safe:animate-gradient-drift sm:px-10 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-500/40 blur-3xl motion-safe:animate-float-slow" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-brand-100/20 blur-3xl motion-safe:animate-float-slower" />
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl motion-safe:animate-float-slow" />
          <div aria-hidden="true" className="pointer-events-none absolute right-8 top-6 hidden sm:block">
            <Sparkles size={32} className="text-brand-100/70 motion-safe:animate-twinkle" />
          </div>

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-50 ring-1 ring-white/25 motion-safe:animate-live-glow">
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-100 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Now live
                <PartyPopper size={16} aria-hidden="true" className="motion-safe:animate-wiggle" />
              </span>
              <h2 className="font-display mt-4 text-2xl font-bold leading-tight sm:text-3xl">
                StayOnMap is on Google&nbsp;Play
                <Rocket size={24} className="ml-2 inline-block align-[-3px] text-brand-100" aria-hidden="true" />
              </h2>
              <p className="mt-3 text-base leading-relaxed text-brand-50/90">
                Every home on this map, now in your pocket — the same live pins,
                the same scores, zero brokers. iOS is next.
              </p>
            </div>

            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-[48px] shrink-0 items-center gap-3 self-start rounded-xl bg-white px-6 text-slate-900 no-underline shadow-md transition-all duration-normal hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-700 md:self-auto"
            >
              <GooglePlayIcon />
              <span className="text-base font-bold">Google Play</span>
              <ArrowRight size={16} strokeWidth={2.5} className="transition-transform duration-normal group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* The WhatsApp mark — same rule as the Play glyph below: lucide has no brand
   glyphs, and the official green is what people recognise. */
function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
        fill="#25D366"
      />
    </svg>
  )
}

/* The Google Play triangle — lucide has no brand glyphs, and the store's
   own mark is what people recognise. Four official colours, inline. */
function GooglePlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.6 1.8 13.9 12 3.6 22.2a1.7 1.7 0 0 1-.6-1.3V3.1c0-.5.2-1 .6-1.3Z" fill="#00D7FE" />
      <path d="M17.3 15.4 13.9 12l3.4-3.4 4.1 2.3c1.1.7 1.1 1.6 0 2.2l-4.1 2.3Z" fill="#FFCE00" />
      <path d="M3.6 1.8c.4-.4 1.1-.4 1.8 0l11.9 6.8L13.9 12 3.6 1.8Z" fill="#00F076" />
      <path d="M3.6 22.2 13.9 12l3.4 3.4L5.4 22.2c-.7.4-1.4.4-1.8 0Z" fill="#F63448" />
    </svg>
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

// Six tiles: five listings plus the nearby card (or six listings when there is
// no nearby card to show — the tile count is what the layout is built around).
//
// Every column count here divides six exactly, so the last row is always full
// and there is never a lone card sitting beside dead space. That was the old
// problem: `auto-fill,minmax(260px,1fr)` opens as many tracks as the container
// fits — six or seven on a wide monitor — and leaves the surplus EMPTY rather
// than stretching the cards into it, so four tiles ended halfway across the
// screen. auto-FIT would have stretched them instead, which on a 1900px row of
// four gives 450px-wide cards. Neither is what this section wants.
//
// Six-across waits for 2xl because below ~1536px it puts each card under 240px,
// and the photo is the part that stops working first.
const CARD_GRID = 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6'
const TILES = 6

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
        {/* Same grid and the same tile count as the real thing — a skeleton in
            a different shape is a layout jump the moment the data lands. */}
        <div className={`mt-8 ${CARD_GRID}`}>
          {Array.from({ length: TILES }, (_, i) => (
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

      <div className={`mt-8 ${CARD_GRID}`}>
        {/* One fewer listing when the nearby card is there to take the last
            tile, one more when it isn't — NearbyCard renders nothing without
            groups, and a five-tile row would leave the hole this grid exists
            to avoid. */}
        {rows.slice(0, nearby.length ? TILES - 1 : TILES).map((property) => (
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
