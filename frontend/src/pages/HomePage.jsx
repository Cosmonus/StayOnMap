import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useUiStore } from '@store/uiStore'
import MapPreview from '@features/map/components/MapPreview'
import PropertyCard from '@features/properties/components/PropertyCard'
import Dropdown from '@components/common/Dropdown'
import SEOMeta from '@components/common/SEOMeta'

import { propertyService } from '@services/property.service'
import { CITIES, CITY_LIST_LABEL } from '@/config/cities'
import { currencySymbol, formatCurrency } from '@utils/format'
import { BRAND, canonical } from '@lib/seo'
import { usePlatformStats } from '@hooks/usePlatformStats'

/* ─── Hooks ─────────────────────────────────────────── */

/** Fade-in on scroll via IntersectionObserver */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/** Animated count-up number */
function CountUp({ target, suffix = '', duration = 1800 }) {
  const [count, setCount] = useState(0)
  const [ref, visible] = useScrollReveal(0.3)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.max(1, Math.floor(target / (duration / 16)))
    const id = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(id) }
      else setCount(start)
    }, 16)
    return () => clearInterval(id)
  }, [visible, target, duration])
  return <span ref={ref}>{count.toLocaleString('en-IN')}{suffix}</span>
}

/** Reveal wrapper — wraps any section in a fade-up */
function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useScrollReveal(0.1)
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ─── Icons ─────────────────────────────────────────── */
const Icon = {
  pin:       <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  grid:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  apartment: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>,
  villa:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v2H6c-1.1 0-2 .9-2 2v14h16V6c0-1.1-.9-2-2-2h-1V2H7zm5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>,
  house:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>,
  pg:        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  rupee:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>,
  arrow:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  search:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
}

function SvgIcon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

/* ─── Data ──────────────────────────────────────────── */
const CITY_OPTIONS = [
  { value: '', label: 'All Cities', icon: Icon.grid },
  ...CITIES.map((c) => ({ value: c.name, label: c.name, icon: Icon.pin })),
]

const TYPE_OPTIONS = [
  { value: '',          label: 'Any Type',    icon: Icon.grid      },
  { value: 'APARTMENT', label: 'Apartment',   icon: Icon.apartment },
  { value: 'VILLA',     label: 'Villa',       icon: Icon.villa     },
  { value: 'HOUSE',     label: 'House',       icon: Icon.house     },
  { value: 'PG',        label: 'PG / Hostel', icon: Icon.pg        },
]

const BUDGET_OPTIONS = [
  { value: '',              label: 'Any Budget',                                               icon: Icon.rupee },
  { value: '0-8000',        label: `Under ${formatCurrency(8000)}`,                            icon: Icon.rupee },
  { value: '8000-15000',    label: `${formatCurrency(8000)} – ${formatCurrency(15000)}`,       icon: Icon.rupee },
  { value: '15000-30000',   label: `${formatCurrency(15000)} – ${formatCurrency(30000)}`,      icon: Icon.rupee },
  { value: '30000-60000',   label: `${formatCurrency(30000)} – ${formatCurrency(60000)}`,      icon: Icon.rupee },
  { value: '60000-999999',  label: `Above ${formatCurrency(60000)}`,                           icon: Icon.rupee },
]

/* ================================================================
   SECTION 1 — HERO  (compact, centered, search integrated)
   ================================================================ */
function HeroSection() {
  const navigate = useNavigate()
  const [city, setCity]     = useState('')
  const [type, setType]     = useState('')
  const [budget, setBudget] = useState('')

  function handleSearch() {
    const params = new URLSearchParams()
    if (city)   params.set('city', city)
    if (type)   params.set('type', type)
    if (budget) params.set('budget', budget)
    navigate(`/properties${params.size ? `?${params}` : ''}`)
  }

  return (
    <section className="relative bg-white pt-20 pb-8 lg:pt-28 lg:pb-16 xl:pt-36 xl:pb-20 overflow-hidden">
      {/* Subtle radial glow — purely decorative */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #12a374 0%, transparent 65%)' }} />
        <div className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #0284c7 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <LiveBadge />

        <h1 className="font-display font-bold text-4xl sm:text-5xl text-slate-900 leading-tight tracking-tight mb-4">
          Rent with <span className="text-brand-600">intelligence</span>.
        </h1>

        <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-7 max-w-xl mx-auto">
          Every home on the live map carries a real-time TrustScore and passes through our fraud-detection engine — real owners, no brokers, across {CITY_LIST_LABEL}.
        </p>

        {/* ── Search bar ── */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-stretch divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <Dropdown value={city}   onChange={setCity}   options={CITY_OPTIONS}   placeholder="Any city" />
            <Dropdown value={type}   onChange={setType}   options={TYPE_OPTIONS}   placeholder="Any type" />
            <Dropdown value={budget} onChange={setBudget} options={BUDGET_OPTIONS} placeholder="Any budget" />
            <button
              onClick={handleSearch}
              className="flex items-center justify-center gap-2 px-7 py-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-bold transition-colors rounded-b-2xl sm:rounded-bl-none sm:rounded-r-2xl shrink-0 whitespace-nowrap"
            >
              {Icon.search}
              <span>{city ? `Search in ${city}` : 'Search rentals'}</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  )
}

/* ================================================================
   LIVE BADGE — real counts only, never simulated activity
   ================================================================ */
function LiveBadge() {
  const { totalActive, isLoading } = usePlatformStats()

  return (
    <Link to="/intelligence" className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-full px-4 py-2 mb-6 no-underline transition-colors">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-xs text-slate-500">
        {isLoading ? 'Loading live listings…' : (
          <><span className="font-semibold text-slate-700">{totalActive}</span> homes live on the map — scored by our intelligence engine</>
        )}
      </span>
    </Link>
  )
}

/* ================================================================
   TRUST BADGES
   ================================================================ */
function TrustBadges() {
  const badges = [
    { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Live TrustScore', desc: 'Every listing scored in real time', to: '/intelligence' },
    { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Zero Brokerage', desc: 'Free for tenants' },
    { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: 'Map-First Search', desc: 'See homes on a live map' },
    { icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Fraud Detection', desc: 'AI agent flags risky listings', to: '/intelligence' },
  ]

  return (
    <section className="border-b border-slate-100 bg-white">
      <Reveal>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 lg:py-16 xl:py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {badges.map(({ icon, label, desc, to }) => {
              const Tag = to ? Link : 'div'
              return (
                <Tag key={label} {...(to ? { to, className: 'flex items-start gap-3 no-underline group' } : { className: 'flex items-start gap-3' })}>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:border-brand-300 transition-colors">
                    <svg className="w-5 h-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                </Tag>
              )
            })}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ================================================================
   BROWSE BY TYPE
   ================================================================ */
function BrowseByType() {
  const types = [
    { type: 'APARTMENT', label: 'Apartments', desc: 'Flats in gated communities', icon: 'M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z', color: 'bg-blue-50 border-blue-100 text-blue-600 hover:border-blue-300' },
    { type: 'VILLA', label: 'Villas', desc: 'Independent homes with garden', icon: 'M7 2v2H6c-1.1 0-2 .9-2 2v14h16V6c0-1.1-.9-2-2-2h-1V2H7zm5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z', color: 'bg-amber-50 border-amber-100 text-amber-600 hover:border-amber-300' },
    { type: 'HOUSE', label: 'Houses', desc: 'Individual floors & row houses', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', color: 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:border-emerald-300' },
    { type: 'PG', label: 'PG / Hostel', desc: 'Shared living, meals included', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', color: 'bg-purple-50 border-purple-100 text-purple-600 hover:border-purple-300' },
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 lg:py-28 xl:py-36">
      <Reveal>
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Browse by type</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
            What kind of home are you looking for?
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {types.map(({ type, label, desc, icon, color }, i) => (
          <Reveal key={type} delay={i * 0.08}>
            <Link
              to={`/properties?type=${type}`}
              className={`block rounded-2xl border p-6 transition-all group no-underline ${color}`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d={icon} /></svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{label}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ================================================================
   VALUE PROP + STATS
   ================================================================ */
function ValuePropSection() {
  const { totalActive, activeOwners, isLoading } = usePlatformStats()

  return (
    <section className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
        <Reveal>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-14">
            <div>
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Not just another listing site</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
                An intelligence engine decides what you see — not a broker&apos;s word
              </h2>
            </div>
            <div>
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                Every listing is posted by the actual owner, manually verified, and scored live by our TrustScore
                engine and fraud-detection agent — the same judgment calls a good broker would make, run as software
                on every home, every time, at a scale no person could match.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Stats + map preview grid */}
        <div className="grid md:grid-cols-5 gap-4">
          <Reveal className="md:col-span-2">
            <div className="relative rounded-2xl overflow-hidden p-7 flex flex-col justify-between min-h-[200px] h-full">
              {/* Background image + overlay */}
              <img src="/backimg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/55" />
              {/* Content */}
              <div className="relative z-10">
                <p className="font-serif font-bold text-5xl md:text-6xl text-white leading-none">
                  <CountUp target={totalActive} />
                </p>
                <p className="text-sm text-white/70 mt-2">live rentals on the map right now</p>
              </div>
              <div className="relative z-10 flex items-center mt-6">
                <span className="text-xs text-white/60">{isLoading ? 'Zero brokers, always' : `Listed directly by ${activeOwners} owners — zero brokers`}</span>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.1}>
            <div className="bg-slate-100 rounded-2xl overflow-hidden relative min-h-[240px] h-full">
              <MapPreview />
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl px-4 py-3 shadow-lg">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Live Map</p>
                <p className="text-xs text-slate-500">Every rental, pinned in real-time</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
   FEATURED LISTINGS
   ================================================================ */
function FeaturedListings() {
  const { data, isLoading } = useQuery({
    queryKey: ['featured-listings'],
    queryFn: () => propertyService.getList({ limit: 4 }),
    staleTime: 5 * 60 * 1000,
  })

  const properties = data?.data ?? data?.properties ?? []

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Featured</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
              Trending rentals right now
            </h2>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0,1,2,3].map(i => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-100 aspect-[3/4]" />
          ))}
        </div>
      </section>
    )
  }

  if (!properties.length) return null

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
      <Reveal>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Featured</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
              Trending rentals right now
            </h2>
          </div>
          <Link to="/properties" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline shrink-0">
            View all
            {Icon.arrow}
          </Link>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {properties.slice(0, 4).map((property, i) => (
          <Reveal key={property.id} delay={i * 0.08} className="h-full">
            <Link to={`/property/${property.id}`} className="no-underline block h-full">
              <PropertyCard property={property} />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ================================================================
   HOW IT WORKS
   ================================================================ */
function HowItWorks() {
  const steps = [
    { num: '01', title: 'Search on the map', description: 'Open the map, pick your city and zoom into the neighbourhood you want. Every pin is a verified rental — no fake listings.', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z' },
    { num: '02', title: 'Filter what fits', description: 'Set your budget, property type and BHK. See only homes that match — no scrolling through 500 irrelevant results.', icon: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' },
    { num: '03', title: 'Contact the owner', description: 'Found the one? Call or message the owner directly from the listing. No broker, no commission, no middleman.', icon: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z' },
    { num: '04', title: 'Move in happy', description: 'Schedule a visit, sign the agreement directly with the owner, and move in — keeping that month\'s brokerage in your pocket.', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10' },
  ]

  return (
    <section className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">How StayOnMap Works</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight max-w-2xl mx-auto">
              From search to move-in, everything stays between you and the owner.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map(({ num, title, description, icon }, i) => (
            <Reveal key={num} delay={i * 0.08}>
              <div className="bg-white rounded-2xl border border-slate-100 p-6 hover:border-slate-300 hover:shadow-md transition-all group h-full">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{num}</span>
                  <div className="w-11 h-11 rounded-xl bg-[#111111] group-hover:bg-brand-600 flex items-center justify-center text-white transition-colors">
                    <SvgIcon d={icon} className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================
   CITY SHOWCASE
   ================================================================ */
const CITY_IMAGE = {
  Bengaluru: '/bengaluru.jpg',
  Chennai:   '/chennai.jpg',
  Hyderabad: '/hyderabad.jpg',
  Delhi:     '/delhi.jpg',
}

function CityShowcase() {
  const [activeCity, setActiveCity] = useState('')
  const { byCity, isLoading } = usePlatformStats()
  const filteredCities = activeCity ? CITIES.filter(c => c.name === activeCity) : CITIES

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
      <Reveal>
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-3">
            Explore rentals across India&apos;s top cities
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto">
            Every neighbourhood, every budget — find your fit on the map.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
          <button
            onClick={() => setActiveCity('')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${!activeCity ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
          >
            All Cities
          </button>
          {CITIES.map(c => (
            <button
              key={c.name}
              onClick={() => setActiveCity(c.name)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${activeCity === c.name ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {filteredCities.map((city, i) => (
          <Reveal key={city.name} delay={i * 0.08} className="h-full">
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-slate-200 transition-all group h-full flex flex-col">
              <div className="h-[420px] shrink-0 bg-slate-950 relative overflow-hidden">
                {CITY_IMAGE[city.name] ? (
                  <img
                    src={CITY_IMAGE[city.name]}
                    alt={city.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <div className="absolute bottom-3 left-4 z-20">
                  <p className="text-xl font-bold text-white">{city.name}</p>
                  <p className="text-xs text-white/80">{city.state}</p>
                </div>
                <div className="absolute bottom-3 right-4 z-20 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg">
                  {isLoading ? (
                    <div className="h-4 w-5 rounded bg-slate-200 animate-pulse" />
                  ) : (
                    <p className="text-sm font-bold text-slate-900">{byCity[city.name] ?? 0}</p>
                  )}
                  <p className="text-[10px] text-slate-500">listings</p>
                </div>
              </div>
              <div className="p-5 flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Popular areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {city.areas.map(area => (
                    <Link
                      key={area}
                      to={`/properties?city=${city.name}&area=${area}`}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-[#111111] hover:text-white transition-colors no-underline border border-slate-100 hover:border-[#111111]"
                    >
                      {area}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ================================================================
   OWNER CTA
   ================================================================ */
function OwnerCTA() {
  const { activeOwners, totalActive, cities } = usePlatformStats()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const benefits = [
    'List unlimited properties for free',
    'Get verified badge & trust score',
    'Direct tenant inquiries — no agents',
    'Real-time analytics on your listing',
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
      <div className="grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-slate-200">
        {/* Left — dark */}
        <Reveal>
          <div className="bg-[#111111] p-10 md:p-14 flex flex-col justify-center h-full">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-4">For Property Owners</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white leading-tight mb-4">
              List your property, find tenants — no broker needed
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              {activeOwners > 0 ? `Join ${activeOwners} owners who list` : 'List'} directly on StayOnMap. Reach genuine tenants, skip the middlemen, and keep 100% of your rental income.
            </p>
            <ul className="space-y-3 mb-8">
              {benefits.map(b => (
                <li key={b} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  {b}
                </li>
              ))}
            </ul>
            <button onClick={openLoginModal} className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-bold rounded-xl transition-colors self-start">
              Start Listing Free
              {Icon.arrow}
            </button>
          </div>
        </Reveal>

        {/* Right — stats */}
        <Reveal delay={0.15}>
          <div className="bg-slate-50 p-10 md:p-14 flex flex-col justify-center h-full">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="font-serif font-bold text-4xl text-slate-900 leading-none mb-1">
                  <CountUp target={activeOwners} />
                </p>
                <p className="text-xs text-slate-500">active owners</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="font-serif font-bold text-4xl text-slate-900 leading-none mb-1">
                  <CountUp target={totalActive} />
                </p>
                <p className="text-xs text-slate-500">live listings</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="font-serif font-bold text-4xl text-slate-900 leading-none mb-1">
                  <CountUp target={cities} />
                </p>
                <p className="text-xs text-slate-500">cities live in</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <p className="font-serif font-bold text-4xl text-emerald-600 leading-none mb-1">{currencySymbol}0</p>
                <p className="text-xs text-slate-500">listing fee, always</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================
   FAQ
   ================================================================ */
function FAQSection() {
  const { totalActive, isLoading } = usePlatformStats()
  const citiesAnswer = isLoading
    ? `We're currently live in ${CITY_LIST_LABEL}. We're opening more cities soon — sign up to get notified when we launch in yours.`
    : `We're currently live in ${CITY_LIST_LABEL} with ${totalActive} verified listings. We're opening more cities soon — sign up to get notified when we launch in yours.`
  const faqs = [
    { q: 'Is StayOnMap really free for tenants?', a: 'Yes — completely. We don\'t charge tenants any brokerage, service fee, or registration cost. You browse, contact the owner, and move in without paying anyone a commission.' },
    { q: 'How do you verify listings?', a: 'Every listing goes through a manual review. We check the owner\'s identity, verify photos match the property, confirm the location pin, and flag anything suspicious. Listings that fail verification are rejected.' },
    { q: 'What cities does StayOnMap cover?', a: citiesAnswer },
    { q: 'How is this different from other rental platforms?', a: 'Most platforms mix broker and owner listings and charge tenants for "premium" access. StayOnMap is owner-only, map-first, and completely free for tenants. Every listing is pinned on a live map so you can judge the commute before you call.' },
    { q: 'I\'m an owner — how do I list my property?', a: 'Sign up, click "Add Listing" from your dashboard, fill in the details and upload photos. Your listing goes through a quick verification and appears on the map. Listing is free, with no limit on how many properties you can add.' },
  ]

  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16">
          <Reveal>
            <div>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
                Rental FAQs
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Everything you need to know about renting through StayOnMap — from how we verify listings to what it costs (spoiler: nothing).
              </p>
              <div className="flex items-center gap-3">
                <Link to="/about" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline">
                  Learn More
                </Link>
                <Link to="/contact" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline">
                  Contact Us
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="space-y-3">
              {faqs.map((faq, i) => {
                const isOpen = openIdx === i
                return (
                  <div key={i} className={`rounded-xl border transition-colors ${isOpen ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <button onClick={() => setOpenIdx(isOpen ? -1 : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                      <span className={`text-sm font-semibold pr-4 ${isOpen ? 'text-slate-900' : 'text-slate-700'}`}>{faq.q}</span>
                      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all ${isOpen ? 'bg-[#111111] rotate-45' : 'bg-slate-100'}`}>
                        <svg className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
   GUIDES / BLOG
   ================================================================ */
function GuidesSection() {
  const guides = [
    { tag: 'For Tenants', title: 'How to Spot a Fake Rental Listing — and What StayOnMap Does About It', excerpt: 'Fake listings cost Indian renters crores every year. Here\'s how to protect yourself and why verified platforms matter.', color: 'bg-brand-600' },
    { tag: 'Market Trends', title: `Rental Prices in ${CITY_LIST_LABEL}: 2026 Update`, excerpt: 'A breakdown of average rents by city, area, and BHK — straight from live listing data. See where you get the best value.', color: 'bg-red-500' },
    { tag: 'For Owners', title: 'List Your Property & Get Genuine Tenants — Without Paying a Broker', excerpt: 'Why owner-direct platforms outperform traditional brokers for occupancy rate, tenant quality, and your bottom line.', color: 'bg-blue-500' },
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
      <Reveal>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
              Rental Guides &amp; Insights
            </h2>
            <p className="text-sm text-slate-500 mt-2">Tips, trends, and tools to help you rent smarter.</p>
          </div>
          <Link to="/about" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline shrink-0">
            See more
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {guides.map((guide, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-slate-200 transition-all group h-full">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2 h-2 rounded-full ${guide.color}`} />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{guide.tag}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-snug mb-3 group-hover:text-brand-600 transition-colors">{guide.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{guide.excerpt}</p>
                <div className="flex items-center gap-1.5 text-brand-600">
                  <span className="text-xs font-semibold">Read more</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ================================================================
   APP DOWNLOAD BANNER
   ================================================================ */
function AppBanner() {
  return (
    <section className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Left — text */}
            <div>
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Coming Soon</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
                StayOnMap in your pocket
              </h2>
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8">
                Get instant alerts when new rentals match your search, chat with owners on-the-go, and never miss a great home again.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {/* App Store placeholder */}
                <div className="flex items-center gap-3 bg-[#111111] text-white rounded-xl px-5 py-3 cursor-default">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <div>
                    <p className="text-[10px] text-slate-400 leading-none">Download on the</p>
                    <p className="text-sm font-semibold leading-tight">App Store</p>
                  </div>
                </div>
                {/* Play Store placeholder */}
                <div className="flex items-center gap-3 bg-[#111111] text-white rounded-xl px-5 py-3 cursor-default">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-.91L19.65 12l-1.93-2.21-2.27 2.27 2.27 2.15zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
                  <div>
                    <p className="text-[10px] text-slate-400 leading-none">Get it on</p>
                    <p className="text-sm font-semibold leading-tight">Google Play</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — India map image */}
            <div className="flex justify-center">
              <div className="rounded-3xl overflow-hidden w-full max-w-md">
                <img src="/india.jpg" alt="StayOnMap across India" className="w-full object-contain" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================
   CTA BANNER
   ================================================================ */
function CTABanner() {
  const { totalActive, isLoading } = usePlatformStats()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 lg:py-32 xl:py-40">
      <Reveal>
        <div className="bg-[#111111] rounded-3xl px-8 md:px-16 py-14 md:py-20 text-center relative overflow-hidden">
          {/* Gradient orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 65%)', transform: 'translate(30%, -50%)' }} />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #ff8c42 0%, transparent 65%)', transform: 'translate(-20%, 40%)' }} />
          {/* Grid texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          <div className="relative z-10">
            <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-4">
              Ready to find your next home?
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-8">
              {isLoading ? 'Zero brokerage.' : `${totalActive} verified rentals. Zero brokerage.`} Map-first search in {CITY_LIST_LABEL}.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-semibold rounded-xl transition-colors no-underline">
                Browse Rentals
                {Icon.arrow}
              </Link>
              <button onClick={openLoginModal} className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors border border-white/10">
                List Your Property
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ================================================================
   PAGE
   ================================================================ */
const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `${BRAND.name} — ${BRAND.tagline}`,
  url: canonical('/'),
  description:
    'Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SEOMeta
        description="Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India."
        canonical={canonical('/')}
        jsonLd={HOME_JSON_LD}
      />
      <HeroSection />
      <TrustBadges />
      <BrowseByType />
      <ValuePropSection />
      <FeaturedListings />
      <HowItWorks />
      <CityShowcase />
      <OwnerCTA />
      <FAQSection />
      <GuidesSection />
      <AppBanner />
      <CTABanner />
    </div>
  )
}
