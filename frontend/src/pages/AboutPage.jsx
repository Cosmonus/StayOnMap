import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye, CircleDollarSign, Settings, Home, MessageSquare, Calendar, FileText,
  Zap, ShieldCheck, MapPin, Globe, ArrowRight,
} from 'lucide-react'
import { CITY_LIST_LABEL, CITIES } from '@/config/cities'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { usePlatformStats } from '@hooks/usePlatformStats'

/* ─── Scroll reveal ─────────────────────────────────── */
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

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useScrollReveal(0.1)
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s` }}>
      {children}
    </div>
  )
}

function CountUp({ target, suffix = '', duration = 1800 }) {
  const [count, setCount] = useState(0)
  const [ref, visible] = useScrollReveal(0.3)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.max(1, Math.floor(target / (duration / 16)))
    const id = setInterval(() => { start += step; if (start >= target) { setCount(target); clearInterval(id) } else setCount(start) }, 16)
    return () => clearInterval(id)
  }, [visible, target, duration])
  return <span ref={ref}>{count.toLocaleString('en-IN')}{suffix}</span>
}

/* ─── Data ──────────────────────────────────────────── */
const TIMELINE = [
  { year: '2023', title: 'Two listings. Ten kilometres apart.', body: 'I was searching for a rental in Chennai. After hours on popular listing sites, I found just two properties — both 10km from where I actually needed to be. The rest? Hidden behind a paywall. Pay to see the address. Pay to get the phone number. Pay just to know if the house even exists.' },
  { year: '2024', title: 'The real problem isn\'t brokers. It\'s the practice.', body: 'Brokers aren\'t the villain. The practice is — demanding a month or two of hard-earned salary just to open a door or make a phone call. Meanwhile owners had no real way to communicate with tenants, track rent, or handle maintenance without going through someone else. Everyone was losing.' },
  { year: '2025', title: 'A platform that works for both sides', body: 'StayOnMap is live across nine cities today. Owners list any of six property types — flats, houses, plots, PGs, shops, short stays — and handle everything in-app: chat with tenants, manage visit appointments, offer and sign leases. Tenants see every listing, for free, no paywalls. Nobody pays for access to a house.' },
]

const VALUES = [
  { icon: Eye, title: 'We show every house. Free.', body: 'No "pay to reveal the address." No locked listings. Every property on StayOnMap is fully visible to any tenant — photos, exact location on the map, rent, the neighbourhood around it. And you reach the owner directly through in-app chat and visit requests.' },
  { icon: CircleDollarSign, title: 'We\'re not against brokers.', body: 'We\'re against the practice of charging months of rent for a phone call and a site visit. If a broker adds real value, they deserve fair pay. What they don\'t deserve is a month\'s salary for thirty minutes of work.' },
  { icon: Settings, title: 'Owners deserve real tools.', body: 'A listing is just the beginning. StayOnMap gives owners a guided listing flow for six property types, appointment management, direct tenant chat, in-app lease offers and signing, and an optional ownership verification that earns a Verified badge.' },
]

const FEATURES = [
  { icon: Home, label: 'Six property types', desc: 'Flats, houses, plots, PGs, shops, and short stays — each with its own tailored listing flow, priced as monthly rent or a lump-sum lease.' },
  { icon: MessageSquare, label: 'Direct chat', desc: 'Owners and tenants talk in real time, in-app — no go-between, no pay-to-unlock phone numbers.' },
  { icon: Calendar, label: 'Visit appointments', desc: 'Request a visit in one tap. Owners accept, reject, or reschedule — both sides track it in their dashboard.' },
  { icon: FileText, label: 'In-app leases', desc: 'Owners offer a lease, tenants sign or decline right on the platform — the agreement is recorded, start to finish.' },
  { icon: ShieldCheck, label: 'Trust & risk scores', desc: 'Community reviews, verification badges, and severity-weighted reports — computed transparently for every listing, never set by hand.' },
  { icon: MapPin, label: 'Neighbourhood intelligence', desc: 'Metro access, daily-life amenities, air quality and terrain around every listing — with the source of every fact shown.' },
]

/* ================================================================ */
export default function AboutPage() {
  const { totalActive, activeOwners, cities, byCity, isLoading } = usePlatformStats()
  const milestones = [
    { label: 'Live Listings', value: totalActive },
    { label: 'Active Owners', value: activeOwners },
    { label: 'Cities Live In', value: cities },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SEOMeta
        title="About Us"
        description="How StayOnMap works: a broker-free, map-first rental platform live in 9 Indian cities — six property types, direct owner chat, in-app visits and leases, zero commission."
        canonical={canonical('/about')}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-16 text-center">
          <Reveal>
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-4">Our Story</p>
            <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-[3.5rem] text-slate-900 leading-[1.1] tracking-tight mb-6">
              Built for owners and tenants.{' '}
              <span className="text-brand-600">Not against anyone.</span>
            </h1>
            <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              StayOnMap started when I spent hours searching for a rental in Chennai and found two listings — both 10km away, the rest locked behind a paywall. There had to be a better way.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold rounded-xl transition-colors no-underline">
                Browse Rentals
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 text-sm font-semibold rounded-xl transition-colors no-underline">
                Get in Touch
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {milestones.map(({ label, value }, i) => (
              <Reveal key={label} delay={i * 0.08}>
                <div className="text-center">
                  <p className="font-serif font-bold text-4xl md:text-5xl text-slate-900 leading-none mb-2">
                    <CountUp target={value} />
                  </p>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION / VISION ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-6">
          <Reveal>
            <div className="bg-[#111111] rounded-2xl p-8 md:p-10 h-full">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center mb-6">
                <Zap className="w-5 h-5 text-brand-400" strokeWidth={1.8} />
              </div>
              <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3">Our Mission</p>
              <h3 className="text-xl font-bold text-white mb-3 leading-snug">Make renting in India transparent, fair, and broker-free.</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every tenant should see every listing — no paywalls, no pay-per-contact. Every owner should be able to manage their property without paying a middleman. We&apos;re building the tools to make that happen.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-emerald-50 rounded-2xl p-8 md:p-10 border border-emerald-100 h-full">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />
              </div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">Our Vision</p>
              <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug">A rental market where trust is the default, not the exception.</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                We&apos;re working toward a future where every rental listing in India is verified, every transaction is transparent, and the relationship between owners and tenants is built on mutual respect — not middlemen.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TIMELINE ── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">How it started</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
                The journey from frustration to platform
              </h2>
            </div>
          </Reveal>

          <div className="relative">
            <div className="absolute left-[18px] sm:left-[68px] top-0 bottom-0 w-px bg-slate-200" />
            <div className="flex flex-col gap-10">
              {TIMELINE.map(({ year, title, body }, i) => (
                <Reveal key={year} delay={i * 0.1}>
                  <div className="flex gap-6 sm:gap-8 items-start">
                    <div className="shrink-0 w-9 sm:w-16 text-right">
                      <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">{year}</span>
                    </div>
                    <div className="relative pl-6">
                      <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-slate-50" />
                      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE BELIEVE ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">What we believe</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
              The principles we build around
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map(({ icon: ValueIcon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="bg-white rounded-2xl p-7 border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all group h-full">
                <div className="w-11 h-11 rounded-xl bg-slate-50 group-hover:bg-[#111111] flex items-center justify-center mb-5 transition-colors">
                  <ValueIcon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── THE PLATFORM ── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">The Platform</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
                More than a listing site
              </h2>
              <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
                Listings are free to browse and free to post. The platform handles everything after you find each other — visits, chat, the lease itself — plus the trust signals and neighbourhood facts that help you choose well in the first place.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: FeatureIcon, label, desc }, i) => (
              <Reveal key={label} delay={i * 0.06}>
                <div className="flex gap-4 p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all group h-full">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-[#111111] flex items-center justify-center transition-colors">
                    <FeatureIcon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 mb-1">{label}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES WE COVER ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Where we operate</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
              Currently live in {CITY_LIST_LABEL}
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">More cities launching soon — sign up to get notified when we arrive in yours.</p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CITIES.map((city, i) => (
            <Reveal key={city.name} delay={i * 0.08}>
              <Link to={`/properties?city=${city.name}`} className="no-underline block">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:border-slate-200 transition-all group text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-[#111111] flex items-center justify-center mx-auto mb-4 transition-colors">
                    <MapPin className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{city.name}</h3>
                  <p className="text-xs text-slate-500 mb-3">{city.state}</p>
                  <p className="text-sm font-bold text-brand-600">{isLoading ? '…' : `${byCity[city.name] ?? 0} listings`}</p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                    {city.areas.slice(0, 4).map(area => (
                      <span key={area} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-100">{area}</span>
                    ))}
                    {city.areas.length > 4 && <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500">+{city.areas.length - 4} more</span>}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── BUILDER ── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <Reveal>
            <div className="grid md:grid-cols-[200px_1fr] gap-10 items-start">
              {/* Photo side */}
              <div className="flex flex-col items-center md:items-start">
                <div className="w-32 h-32 rounded-3xl bg-[#111111] flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-white font-display font-bold text-4xl">SG</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                  <a href="https://www.srigokulkrishnan.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-[#111111] flex items-center justify-center transition-colors no-underline">
                    <Globe className="w-4 h-4 text-slate-500" strokeWidth={2} />
                  </a>
                  <a href="https://www.linkedin.com/in/srigokulkrishnan/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-[#111111] flex items-center justify-center transition-colors no-underline">
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                  </a>
                  <a href="https://x.com/srigokulkrishn" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-[#111111] flex items-center justify-center transition-colors no-underline">
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                </div>
              </div>

              {/* Bio side */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">The person behind it</p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 mb-4">Sri Gokul Krishnan</h2>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-4">
                  Based in Chennai. I built StayOnMap after spending weeks searching for a rental — finding paywalls instead of listings, and commission demands instead of conversations. The tools for owners and tenants to work together directly just didn&apos;t exist. So I built them.
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  I believe technology should remove friction, not add toll gates. StayOnMap is my bet that a transparent, owner-direct platform can replace the broken brokerage model — one city at a time.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <Reveal>
          <div className="bg-[#111111] rounded-3xl px-8 md:px-16 py-14 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative">
              <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-4">
                Ready to find your home?
              </h2>
              <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto mb-8">
                Every listing is visible. No paywalls. No commission. Just homes — pinned on a map.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-semibold rounded-xl transition-colors no-underline">
                  Browse Rentals
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors no-underline border border-white/10">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  )
}
