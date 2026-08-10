import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  CircleHelp, TriangleAlert, Users, Mail, ShieldCheck, Building2, Check,
  Send, ArrowUpRight, Zap, Lock, User, MapPin, Plus, ArrowRight, Loader2,
} from 'lucide-react'
import { CITIES } from '@/config/cities'
import { contactService } from '@services/contact.service'
import { supportService } from '@services/support.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { usePlatformStats } from '@hooks/usePlatformStats'
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

/* ─── Data ──────────────────────────────────────────── */
const TOPICS = [
  { value: 'question',    label: 'I have a question',  icon: CircleHelp },
  { value: 'report',      label: 'Report a listing',   icon: TriangleAlert },
  { value: 'partnership', label: 'Partnership',         icon: Users },
  { value: 'other',       label: 'Something else',      icon: Mail },
]

const CONTACT_CHANNELS = [
  { label: 'General enquiry', email: 'hello@cosmonus.com', desc: 'Questions about the platform, features, or your account.', icon: Mail, color: 'bg-blue-50 border-blue-100 text-blue-600 hover:border-blue-300' },
  { label: 'Report a listing', email: 'hello@cosmonus.com', desc: 'Found something suspicious? Our trust team reviews every report within 24 hours.', icon: ShieldCheck, color: 'bg-amber-50 border-amber-100 text-amber-600 hover:border-amber-300' },
  { label: 'Partnerships', email: 'hello@cosmonus.com', desc: 'Want to work together? We partner with property managers, housing societies, and corporates.', icon: Building2, color: 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:border-emerald-300' },
]

const FAQS = [
  { q: 'How long does it take to get a reply?', a: 'We aim to respond within 24 hours on business days. Report-a-listing queries are prioritised and typically handled within 6 hours.' },
  { q: 'Can I call instead of emailing?', a: 'We don\'t have a phone line yet — email is the fastest way to reach us. We\'re a small team and written communication helps us give you a better, more considered answer.' },
  { q: 'I found a fake listing. What should I do?', a: 'Use the "Report a listing" topic in the form below, or email hello@cosmonus.com directly with the listing URL. Our trust team investigates every report and takes action within 24 hours.' },
  { q: 'Do you offer partnerships for housing societies?', a: 'Yes! If you manage a society or corporate housing program, reach out via the partnerships channel. We offer bulk listing tools, branded pages, and priority verification.' },
]

// The form's four topics, mapped onto case types. "Report a listing"
// deliberately does NOT map to PROPERTY_REPORT — see the mutation below.
const CONTACT_CASE_TYPE = {
  question: 'GENERAL_SUPPORT',
  report: 'SAFETY_REPORT',
  partnership: 'OTHER',
  other: 'OTHER',
}
const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]))

const MAX_MESSAGE = 1000

/* ================================================================ */
export default function ContactPage() {
  const [sent, setSent]   = useState(false)
  const [form, setForm]   = useState({ name: '', email: '', topic: '', message: '' })
  const [openFaq, setOpenFaq] = useState(0)
  const { user } = useAuth()
  const { totalActive, isLoading, isError } = usePlatformStats()
  const statsUnknown = isLoading || isError

  // Until 2026-08-10 this was `e.preventDefault(); setSent(true)` — no request,
  // no mailto, and no backend route existed. The success screen then promised a
  // reply within 24 hours to a message that had gone nowhere. The success state
  // is now set from the server's answer and nothing else.
  // Signed in, it becomes a tracked CASE; signed out, it stays an email.
  //
  // The split is the whole point. A case can be replied to, followed and
  // reopened, and both sides can see it — but it needs an account to belong to.
  // Somebody locked out of theirs still has to be able to reach us, which is
  // most of what a public contact form is for, so the email path stays.
  const mutation = useMutation({
    mutationFn: (payload) => (user
      ? supportService.createCase({
        // Mapped from the form's four topics. `report` does NOT become a
        // PROPERTY_REPORT: that path runs the risk score and the auto-suspend
        // rule and needs to know WHICH listing, which this form never asks.
        // It opens a safety case a moderator can act on instead.
        type: CONTACT_CASE_TYPE[payload.topic] ?? 'GENERAL_SUPPORT',
        subject: `${TOPIC_LABEL[payload.topic] ?? 'Contact'} — ${payload.name}`.slice(0, 140),
        description: payload.message,
      })
      : contactService.send(payload)),
    onSuccess: () => setSent(true),
  })

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
    if (mutation.isPending) return
    mutation.mutate(form)
  }

  const charsLeft = MAX_MESSAGE - form.message.length
  const canSubmit = form.name && form.email && form.topic && form.message && !mutation.isPending

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SEOMeta
        title="Contact Us"
        description="Questions about StayOnMap, a listing to report, or a partnership to discuss? Reach the team directly — no ticket queue, real replies within 24 hours."
        canonical={canonical('/contact')}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #0d8a5f 0%, transparent 70%)' }} />
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
          {CONTACT_CHANNELS.map(({ label, email, desc, icon: ChannelIcon, color }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <a
                href={`mailto:${email}`}
                className={`flex flex-col h-full rounded-2xl border p-6 transition-all no-underline group ${color}`}
              >
                <div className="w-11 h-11 rounded-xl bg-white/80 flex items-center justify-center mb-4">
                  <ChannelIcon className="w-5 h-5" strokeWidth={1.8} />
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
                    <div className="w-16 h-16 rounded-full bg-[#111111] flex items-center justify-center mb-5">
                      <Check size={26} color="white" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Message sent!</h3>
                    <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
                      We&apos;ll get back to you at <span className="font-semibold text-slate-700">{form.email}</span> within 24 hours.
                    </p>
                    <button onClick={() => { setSent(false); mutation.reset(); setForm({ name: '', email: '', topic: '', message: '' }) }} className="px-5 py-2 rounded-full text-xs font-semibold border border-slate-200 text-slate-500 hover:border-[#111111] hover:text-slate-800 transition-colors">
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
                          {TOPICS.map(({ value, label, icon: TopicIcon }) => (
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
                              <TopicIcon className={`w-4 h-4 shrink-0 ${form.topic === value ? 'text-white' : 'text-slate-500'}`} strokeWidth={1.8} />
                              <span className="text-xs font-semibold leading-tight">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Name + Email */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Your name</label>
                          <input name="name" value={form.name} onChange={handleChange} required placeholder="Sri Gokul" className="min-h-[44px] w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                          <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="you@email.com" className="min-h-[44px] w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition" />
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Message</label>
                          <span className={`text-xs tabular-nums transition-colors ${charsLeft < 100 ? 'text-brand-600 font-semibold' : 'text-slate-500'}`}>{charsLeft}</span>
                        </div>
                        <textarea name="message" value={form.message} onChange={handleChange} required rows={5} placeholder="Tell us what's on your mind..." className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed" />
                      </div>
                    </div>

                    <div className="px-6 pb-6">
                      {mutation.isError && (
                        <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                          <TriangleAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
                          <p className="text-xs text-red-700 leading-relaxed">
                            {/* Both axios instances reject with the response BODY, so the
                                server's own message is `err.message` — reaching
                                through a `.response` wrapper finds nothing. */}
                            {mutation.error?.message || 'Your message could not be sent.'}{' '}
                            You can email <a href="mailto:hello@cosmonus.com" className="font-semibold underline">hello@cosmonus.com</a> instead.
                          </p>
                        </div>
                      )}
                      <button type="submit" disabled={!canSubmit} className={['min-h-[44px] w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all duration-150', canSubmit ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white shadow-sm hover:shadow-md' : 'bg-slate-100 text-slate-500 cursor-not-allowed'].join(' ')}>
                        {mutation.isPending ? 'Sending…' : 'Send message'}
                        {mutation.isPending
                          ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
                          : <Send size={14} strokeWidth={2.5} />}
                      </button>
                      {!canSubmit && !mutation.isPending && (
                        <p className="text-center text-xs text-slate-500 mt-2">
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
                    <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg mb-4">C</div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Built by</p>
                    <p className="text-base font-bold mb-2">Cosmonus</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      Cosmonus engineers intelligence. StayOnMap is that intelligence running in production — a broker-free rental platform for India.
                    </p>
                    <a
                      href="https://www.cosmonus.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors no-underline"
                    >
                      Visit Cosmonus
                      <ArrowUpRight size={12} strokeWidth={2.5} />
                    </a>
                  </div>
                </div>

                {/* Response promise */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">What to expect</p>
                  <div className="flex flex-col gap-3.5">
                    {[
                      { icon: Zap, text: 'Reply within 24 hours' },
                      { icon: Lock, text: 'Your info stays private' },
                      { icon: User, text: 'Real human, not a bot' },
                    ].map(({ icon: ExpectIcon, text }) => (
                      <div key={text} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <ExpectIcon className="w-4 h-4 text-slate-500" />
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
                      <MapPin className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Chennai, India</p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">Building for renters and owners across {CITIES.length} cities and growing.</p>
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
              <Link to="/about" className="min-h-[44px] inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition-colors no-underline">
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
                        <Plus className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-slate-500'}`} strokeWidth={2.5} />
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
              <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto mb-8">
                {statsUnknown ? 'Zero brokerage.' : `${totalActive} verified rentals. Zero brokerage.`} Open the map and start exploring.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link to="/properties" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 text-[#111111] text-sm font-semibold rounded-xl transition-colors no-underline">
                  Browse Rentals
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
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
