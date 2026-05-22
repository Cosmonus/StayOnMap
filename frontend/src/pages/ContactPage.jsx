import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CITIES } from '@/config/cities'

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

/* ─── Data ──────────────────────────────────────────── */
const TOPICS = [
  { value: 'question',    label: 'I have a question',  icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { value: 'report',      label: 'Report a listing',   icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { value: 'partnership', label: 'Partnership',         icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { value: 'other',       label: 'Something else',      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
]

const CONTACT_CHANNELS = [
  { label: 'General enquiry', email: 'srigokulkrishnan@gmail.com', desc: 'Questions about the platform, features, or your account.', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'bg-blue-50 border-blue-100 text-blue-600 hover:border-blue-300' },
  { label: 'Report a listing', email: 'srigokulkrishnan@gmail.com', desc: 'Found something suspicious? Our trust team reviews every report within 24 hours.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'bg-amber-50 border-amber-100 text-amber-600 hover:border-amber-300' },
  { label: 'Partnerships', email: 'srigokulkrishnan@gmail.com', desc: 'Want to work together? We partner with property managers, housing societies, and corporates.', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:border-emerald-300' },
]

const FAQS = [
  { q: 'How long does it take to get a reply?', a: 'We aim to respond within 24 hours on business days. Report-a-listing queries are prioritised and typically handled within 6 hours.' },
  { q: 'Can I call instead of emailing?', a: 'We don\'t have a phone line yet — email is the fastest way to reach us. We\'re a small team and written communication helps us give you a better, more considered answer.' },
  { q: 'I found a fake listing. What should I do?', a: 'Use the "Report a listing" topic in the form below, or email srigokulkrishnan@gmail.com directly with the listing URL. Our trust team investigates every report and takes action within 24 hours.' },
  { q: 'Do you offer partnerships for housing societies?', a: 'Yes! If you manage a society or corporate housing program, reach out via the partnerships channel. We offer bulk listing tools, branded pages, and priority verification.' },
]

const MAX_MESSAGE = 1000

/* ================================================================ */
export default function ContactPage() {
  const [sent, setSent]   = useState(false)
  const [form, setForm]   = useState({ name: '', email: '', topic: '', message: '' })
  const [openFaq, setOpenFaq] = useState(0)

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'message' && value.length > MAX_MESSAGE) return
    setForm((f) => ({ ...f, [name]: value }))
  }

  function setTopic(value) {
    setForm((f) => ({ ...f, topic: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSent(true)
  }

  const charsLeft = MAX_MESSAGE - form.message.length
  const canSubmit = form.name && form.email && form.topic && form.message

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-16 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-500 text-xs font-semibold mb-6 tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Usually replies within a day
            </span>
            <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-[3.5rem] text-slate-900 leading-[1.1] tracking-tight mb-5">
              We&apos;re real people.{' '}
              <span className="text-brand-600">We actually reply.</span>
            </h1>
            <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Have a question, spotted something off, or want to collaborate? Drop us a line — we read every message.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CONTACT CHANNELS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {CONTACT_CHANNELS.map(({ label, email, desc, icon, color }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <a
                href={`mailto:${email}`}
                className={`flex flex-col h-full rounded-2xl border p-6 transition-all no-underline group ${color}`}
              >
                <div className="w-11 h-11 rounded-xl bg-white/80 flex items-center justify-center mb-4 shadow-sm">
                  <SvgIcon d={icon} className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{label}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 flex-1">{desc}</p>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-brand-600 transition-colors">{email}</span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FORM + SIDEBAR ── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Send a message</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight">
                Or use the form — we read every one
              </h2>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start max-w-5xl mx-auto">
            {/* Form */}
            <Reveal>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#111111] flex items-center justify-center mb-5 shadow-lg">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Message sent!</h3>
                    <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
                      We&apos;ll get back to you at <span className="font-semibold text-slate-700">{form.email}</span> within 24 hours.
                    </p>
                    <button onClick={() => { setSent(false); setForm({ name: '', email: '', topic: '', message: '' }) }} className="px-5 py-2 rounded-full text-xs font-semibold border border-slate-200 text-slate-500 hover:border-[#111111] hover:text-slate-800 transition-colors">
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="px-6 py-5 flex flex-col gap-5">
                      {/* Topic */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2.5">What&apos;s this about?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {TOPICS.map(({ value, label, icon }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setTopic(value)}
                              className={[
                                'flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-all duration-150',
                                form.topic === value
                                  ? 'bg-[#111111] border-[#111111] text-white shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-white',
                              ].join(' ')}
                            >
                              <SvgIcon d={icon} className={`w-4 h-4 shrink-0 ${form.topic === value ? 'text-white' : 'text-slate-400'}`} />
                              <span className="text-xs font-semibold leading-tight">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name + Email */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Your name</label>
                          <input name="name" value={form.name} onChange={handleChange} required placeholder="Sri Gokul" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                          <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="you@email.com" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition" />
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Message</label>
                          <span className={`text-xs tabular-nums transition-colors ${charsLeft < 100 ? 'text-brand-600 font-semibold' : 'text-slate-300'}`}>{charsLeft}</span>
                        </div>
                        <textarea name="message" value={form.message} onChange={handleChange} required rows={5} placeholder="Tell us what's on your mind..." className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed" />
                      </div>
                    </div>

                    <div className="px-6 pb-6">
                      <button type="submit" disabled={!canSubmit} className={['w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all duration-150', canSubmit ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white shadow-sm hover:shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'].join(' ')}>
                        Send message
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                      {!canSubmit && (
                        <p className="text-center text-xs text-slate-400 mt-2">
                          {!form.topic ? 'Pick a topic above to continue' : 'Fill in all fields to send'}
                        </p>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </Reveal>

            {/* Sidebar */}
            <Reveal delay={0.15}>
              <div className="flex flex-col gap-4">
                {/* Builder card */}
                <div className="rounded-2xl bg-[#111111] text-white p-6 overflow-hidden relative">
                  <div aria-hidden className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg mb-4">S</div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Built by</p>
                    <p className="text-base font-bold mb-2">Sri Gokul Krishnan</p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Based in Chennai. Built StayOnMap after spending weeks searching for a rental — hitting paywalls at every turn.
                    </p>
                    <div className="flex items-center gap-2">
                      <a href="https://www.srigokulkrishnan.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors no-underline">
                        <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                      </a>
                      <a href="https://www.linkedin.com/in/srigokulkrishnan/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors no-underline">
                        <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                      </a>
                      <a href="https://x.com/srigokulkrishn" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors no-underline">
                        <svg className="w-3.5 h-3.5 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Response promise */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">What to expect</p>
                  <div className="flex flex-col gap-3.5">
                    {[
                      { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Reply within 24 hours' },
                      { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', text: 'Your info stays private' },
                      { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', text: 'Real human, not a bot' },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <SvgIcon d={icon} className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-xs text-slate-600 font-medium">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Office info */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Based in</p>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                      <SvgIcon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Chennai, India</p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-0.5">Building for renters and owners across {CITIES.length} cities and growing.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 max-w-5xl mx-auto">
          <Reveal>
            <div>
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Common questions</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-slate-900 leading-tight mb-4">
                Before you write
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                These cover the most common things people ask us. If your question isn&apos;t here, the form above is always open.
              </p>
              <Link to="/about" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline">
                About StayOnMap
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="space-y-3">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i
                return (
                  <div key={i} className={`rounded-xl border transition-colors ${isOpen ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <button onClick={() => setOpenFaq(isOpen ? -1 : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
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
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 md:pb-24">
        <Reveal>
          <div className="bg-[#111111] rounded-3xl px-8 md:px-16 py-14 md:py-20 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
            <div className="relative">
              <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-4">
                Rather browse than write?
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-8">
                6,000+ verified rentals. Zero brokerage. Open the map and start exploring.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-semibold rounded-xl transition-colors no-underline">
                  Browse Rentals
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link to="/about" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors no-underline border border-white/10">
                  About Us
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  )
}
