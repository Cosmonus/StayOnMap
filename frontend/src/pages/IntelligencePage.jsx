import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
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

function SvgIcon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
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
  { weight: 20, label: 'Safety',        icon: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z' },
  { weight: 15, label: 'Cleanliness',   icon: 'M8 3v4M16 3v4M4 11h16M5 7h14a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a1 1 0 011-1z' },
  { weight: 15, label: 'Neighborhood',  icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6' },
  { weight: 7,  label: 'Water supply',  icon: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z' },
  { weight: 7,  label: 'Noise levels',  icon: 'M11 5L6 9H2v6h4l5 4V5z M19 8a5 5 0 010 8' },
  { weight: 7,  label: 'Internet',      icon: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01' },
  { weight: 7,  label: 'Parking',       icon: 'M9 17V7h4a3 3 0 010 6H9 M3 21h18M4 21V7a2 2 0 012-2h9l5 5v11' },
  { weight: 7,  label: 'Transport',     icon: 'M8 19v2m8-2v2M5 17h14a1 1 0 001-1v-6a4 4 0 00-4-4H8a4 4 0 00-4 4v6a1 1 0 001 1z' },
  { weight: 7,  label: 'Maintenance',   icon: 'M14.7 6.3a5 5 0 00-6.4 6.4L3 18v3h3l5.3-5.3a5 5 0 006.4-6.4l-3.3 3.3-2-2z' },
  { weight: 7,  label: 'Owner conduct', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { weight: 7,  label: 'Security',      icon: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z M9 12l2 2 4-4' },
  { weight: 6,  label: 'Power backup',  icon: 'M13 2L4 14h6l-1 8 9-12h-6z' },
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
        description="StayOnMap runs on a live TrustScore engine and an AI fraud-detection agent, engineered by Cosmonus — trust computed from signals, not a broker's judgment call."
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
          {SIGNALS.map(({ weight, label, icon }, i) => (
            <Reveal key={label} delay={i * 0.04}>
              <div className="flex flex-col gap-3 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all h-full">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
                    <SvgIcon d={icon} className="w-4 h-4 text-slate-600" />
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
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  )
}
