import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, Trash2, Home, Droplet, Volume2, Wifi, SquareParking, Bus, Wrench,
  User, ShieldCheck, Zap, ArrowRight,
} from 'lucide-react'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'

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

/* ─── Live badge ────────────────────────────────────── */
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-xs font-semibold text-slate-200 tracking-wide">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live &middot; engineered by Cosmonus
    </span>
  )
}

/* ─── Data ──────────────────────────────────────────── */
const SIGNALS = [
  { weight: 20, label: 'Safety',        icon: Shield },
  { weight: 15, label: 'Cleanliness',   icon: Trash2 },
  { weight: 15, label: 'Neighborhood',  icon: Home },
  { weight: 7,  label: 'Water supply',  icon: Droplet },
  { weight: 7,  label: 'Noise levels',  icon: Volume2 },
  { weight: 7,  label: 'Internet',      icon: Wifi },
  { weight: 7,  label: 'Parking',       icon: SquareParking },
  { weight: 7,  label: 'Transport',     icon: Bus },
  { weight: 7,  label: 'Maintenance',   icon: Wrench },
  { weight: 7,  label: 'Owner conduct', icon: User },
  { weight: 7,  label: 'Security',      icon: ShieldCheck },
  { weight: 6,  label: 'Power backup',  icon: Zap },
]

const PIPELINE = [
  { title: 'Signal in', body: 'A review is approved, a report is filed, or ownership is verified — each is a compounding signal, not a one-time rating.' },
  { title: 'Score recomputes', body: 'The 12 weighted signals plus area, water and flood-risk data recompute the StayScore for that property, in real time.' },
  { title: 'Agent checks for fraud', body: 'An AI agent reads the listing text, pricing, images and report history for the patterns a broker would spot by instinct — bait pricing, copied descriptions, deposit anomalies.' },
  { title: 'Risk score reacts', body: 'Fraud signals feed the risk formula alongside report severity and verification level. Cross a threshold, and the listing auto-suspends — no admin has to notice first.' },
]

const BADGES = [
  { label: 'Highly Recommended', tone: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  { label: 'Community Trusted',  tone: 'bg-brand-100 text-brand-800',     dot: 'bg-brand-500' },
  { label: 'Verified Owner',     tone: 'bg-indigo-100 text-indigo-800',   dot: 'bg-indigo-500' },
  { label: 'Under Review',       tone: 'bg-yellow-100 text-yellow-800',   dot: 'bg-yellow-500' },
  { label: 'Needs Attention',    tone: 'bg-orange-100 text-orange-800',   dot: 'bg-orange-500' },
  { label: 'Suspicious',         tone: 'bg-red-100 text-red-800',         dot: 'bg-red-500' },
]

/* ================================================================ */
export default function IntelligencePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SEOMeta
        title="The Intelligence Behind StayOnMap"
        description="StayOnMap runs on a live TrustScore engine and an AI fraud-detection agent, engineered by Cosmonus — trust computed from signals, not guesswork."
        canonical={canonical('/intelligence')}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#111111]">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-20 text-center">
          <Reveal>
            <div className="flex justify-center mb-6">
              <LiveBadge />
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-[3.5rem] text-white leading-[1.1] tracking-tight mb-6">
              Cosmonus intelligence,{' '}
              <span className="text-brand-400">running in production.</span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              StayOnMap isn&apos;t a listing site with an algorithm bolted on. Every property carries a TrustScore computed from
              12 compounding signals, and every report triggers an agent built to catch what a broker would only ever
              catch by gut feeling. This is what Cosmonus means by engineering intelligence — not a slogan, a running system.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 12 SIGNALS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">The TrustScore engine</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
              12 signals, one compounding score
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              No property starts trusted. The score is earned, review by review, and it moves the moment new evidence comes in —
              weighted the way a careful tenant would weigh it, at a scale no single person could keep up with.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SIGNALS.map(({ weight, label, icon: SignalIcon }, i) => (
            <Reveal key={label} delay={i * 0.04}>
              <div className="flex flex-col gap-3 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all h-full">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
                    <SignalIcon className="w-4 h-4 text-slate-600" strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-bold text-brand-600">{weight}%</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PIPELINE ── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">How the loop runs</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
                An agent, not a checkbox
              </h2>
            </div>
          </Reveal>

          <div className="relative">
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200" />
            <div className="flex flex-col gap-10">
              {PIPELINE.map(({ title, body }, i) => (
                <Reveal key={title} delay={i * 0.1}>
                  <div className="flex gap-6 items-start">
                    <div className="relative shrink-0 w-9 h-9 rounded-full bg-[#111111] text-white text-sm font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div>
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

      {/* ── BADGES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">What tenants see</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
              The score becomes a verdict
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Every listing carries one of these badges, assigned automatically from the live score — never set by hand.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-wrap justify-center gap-3">
          {BADGES.map(({ label, tone, dot }) => (
            <span key={label} className={`inline-flex items-center gap-2 rounded-full font-semibold text-sm px-4 py-2 ${tone}`}>
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 md:pb-24">
        <Reveal>
          <div className="bg-[#111111] rounded-3xl px-8 md:px-16 py-14 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative">
              <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-4">
                See the score on a real listing
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-8">
                Every badge on StayOnMap is live, computed from this engine, on every property, right now.
              </p>
              <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-semibold rounded-xl transition-colors no-underline">
                Browse Rentals
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  )
}
