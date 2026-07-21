import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Home } from 'lucide-react'
import MapView from '@features/map/components/MapView'
import MapLegend from '@features/map/components/MapLegend'
import AreaInsightCard from '@features/map/components/AreaInsightCard'
import MapRightPanel from '@features/map/components/MapRightPanel'
import PropertyCard from '@features/properties/components/PropertyCard'
import SEOMeta from '@components/common/SEOMeta'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useUiStore } from '@store/uiStore'
import { useAuth } from '@features/auth/hooks/useAuth'
import { BRAND, canonical } from '@lib/seo'
import { usePlatformStats } from '@hooks/usePlatformStats'
import { toQueryParams } from '@/config/filters'
import { useFilterUrlSync } from '@features/filters/hooks/useFilterUrlSync'

const HOW_IT_WORKS_STEPS = [
  { num: '01', title: 'Search on the map', description: 'Open the map, pick your city and zoom into the neighbourhood you want. Every pin is a verified rental.' },
  { num: '02', title: 'Filter what fits', description: 'Set your budget, property type and BHK to see only homes that match — no scrolling through irrelevant results.' },
  { num: '03', title: 'Contact the owner', description: 'Found the one? Call or message the owner directly. No broker, no commission, no middleman.' },
  { num: '04', title: 'Move in happy', description: 'Schedule a visit, sign the agreement directly with the owner, and move in — keeping that month\'s brokerage in your pocket.' },
]

/* ================================================================
   MAP HERO — the homepage IS the map
   ================================================================ */
function MetricCard({ value, label }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4">
      <p className="text-2xl font-bold text-slate-900 leading-none mb-1 font-mono">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function AppComingSoonCard() {
  return (
    <div className="mt-10 rounded-3xl border border-slate-100 p-7 bg-gradient-to-b from-slate-50 to-white">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">Coming soon</span>
        <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-900 leading-tight mb-2">
        Take StayOnMap with you.
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5 max-w-sm">
        The live map, TrustScores and owner chat — soon in your pocket. Native apps landing on
        Android and iOS.
      </p>
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-3 bg-[#111111] text-white rounded-xl px-4 py-3 cursor-default opacity-90">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <div className="leading-tight">
            <p className="text-[10px] text-white/60">On the</p>
            <p className="text-sm font-semibold">App Store</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 bg-[#111111] text-white rounded-xl px-4 py-3 cursor-default opacity-90">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-.91L19.65 12l-1.93-2.21-2.27 2.27 2.27 2.15zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
          <div className="leading-tight">
            <p className="text-[10px] text-white/60">Get it on</p>
            <p className="text-sm font-semibold">Google Play</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3.5">
        <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-100 rounded-full py-1.5">
          iOS · coming soon
        </span>
        <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-100 rounded-full py-1.5">
          Android · coming soon
        </span>
      </div>
    </div>
  )
}

function MapPanel({ widthClass }) {
  return (
    <div className={`relative h-[60vh] md:h-[calc(100vh-190px)] min-h-[420px] w-full ${widthClass} rounded-3xl overflow-hidden border border-slate-200 shadow-sm`}>
      <MapView contained />
      <MapLegend />
      <AreaInsightCard />
      <MapRightPanel contained topClass="top-5" />
    </div>
  )
}

function MapHeroSection() {
  const { totalActive, activeOwners, cities, isLoading } = usePlatformStats()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const { user } = useAuth()

  return (
    <section className="w-full pt-[132px] md:pt-[166px] pb-4 md:pb-6 px-4 md:px-6 flex flex-col lg:flex-row items-start gap-4 md:gap-6">
      {/* Logged in: the map is the whole hero. Guests keep the marketing panel.
          The side-by-side split starts at lg, not md — at 768px a 30% panel is
          ~230px and the metric grid inside it wraps badly; tablets stack. */}
      <MapPanel widthClass={user ? '' : 'lg:w-[70%]'} />

      {!user && (
        <div className="w-full lg:w-[30%] py-8 md:py-10">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">
            About StayOnMap
          </p>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight tracking-tight mb-3">
            Rent with <span className="text-brand-600">intelligence</span>.
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
            Every home on the live map carries a real-time TrustScore and passes through our
            fraud-detection engine — real owners, no brokers.
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-7">
            <Link to="/properties" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors no-underline">
              Browse rentals
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            <button onClick={openLoginModal} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 hover:border-slate-400 transition-colors">
              List your property
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-8">
            <MetricCard value="₹0" label="Brokerage, always" />
            <MetricCard value={isLoading ? '—' : cities} label="Cities live in" />
            <MetricCard value={isLoading ? '—' : totalActive} label="Live listings" />
            <MetricCard value={isLoading ? '—' : activeOwners} label="Active owners" />
          </div>

          <h2 className="font-display font-bold text-lg text-slate-900 leading-snug mt-10 mb-5">
            How it works
          </h2>
          <div className="flex flex-col gap-6">
            {HOW_IT_WORKS_STEPS.map(({ num, title, description }) => (
              <div key={num} className="flex gap-4 items-start">
                <span className="shrink-0 w-[30px] h-[30px] rounded-full bg-slate-900 text-white font-mono text-xs font-semibold flex items-center justify-center">
                  {num}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-0.5">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <AppComingSoonCard />
        </div>
      )}
    </section>
  )
}

function EmptySlotCard() {
  return (
    <div className="aspect-[3/4] rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-center px-3">
      <Home size={22} stroke="#cbd5e1" strokeWidth={1.8} />
      <p className="text-xs text-slate-400 leading-snug">More rentals<br />coming soon</p>
    </div>
  )
}

/* ================================================================
   FEATURED RENTALS — social proof + SEO content below the map
   ================================================================ */
function FeaturedListings() {
  const filters = useFilterStore((s) => s.filters)
  const params = toQueryParams(filters)

  const { data, isLoading } = useQuery({
    queryKey: ['featured-listings', params],
    queryFn: () => propertyService.getList({ limit: 6, ...params }),
    staleTime: 5 * 60 * 1000,
  })

  const properties = data?.data ?? data?.properties ?? []
  const viewAllLink = filters.city ? `/properties?city=${encodeURIComponent(filters.city)}` : '/properties'

  return (
    <section className="w-full px-4 md:px-6 py-14 md:py-20">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Featured</p>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-slate-900 leading-tight">
            {filters.city ? `Trending rentals in ${filters.city}` : 'Trending rentals right now'}
          </h2>
        </div>
        <Link to={viewAllLink} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline shrink-0">
          View all
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {isLoading
          ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="animate-pulse rounded-xl bg-slate-100 aspect-[3/4]" />)
          : (
            <>
              {properties.slice(0, 6).map((property) => (
                <Link key={property.id} to={`/property/${property.id}`} className="no-underline block h-full">
                  <PropertyCard property={property} />
                </Link>
              ))}
              {Array.from({ length: Math.max(0, 6 - properties.length) }).map((_, i) => (
                <EmptySlotCard key={`empty-${i}`} />
              ))}
            </>
          )}
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

  return (
    <div className="bg-white overflow-x-hidden">
      <SEOMeta
        description="Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India."
        canonical={canonical('/')}
        jsonLd={HOME_JSON_LD}
      />
      <MapHeroSection />
      {!user && <FeaturedListings />}
    </div>
  )
}
