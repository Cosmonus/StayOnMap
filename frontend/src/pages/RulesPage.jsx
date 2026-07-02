import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'

// ── Data ────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: 'owners',  label: 'Owners',  emoji: '🏠', tagline: 'You list. You set the terms. You keep 100% of the rent.' },
  { id: 'tenants', label: 'Tenants', emoji: '🔑', tagline: 'You browse. You contact. You move in — zero commission.' },
  { id: 'brokers', label: 'Brokers', emoji: '🚫', tagline: 'Unauthorized commission demands are not welcome here.' },
]

const RULES = {
  owners: {
    summary: 'Be honest, be responsive, be fair. Your listing represents a home someone will live in.',
    dos: [
      { text: 'List only properties you own or are legally authorized to rent out', icon: 'shield' },
      { text: 'Upload real photos — at least 3 clear images of the actual property', icon: 'camera' },
      { text: 'State the exact rent, deposit, and maintenance charges upfront', icon: 'currency' },
      { text: 'Respond to tenant inquiries within 48 hours', icon: 'clock' },
      { text: 'Mark your listing as rented as soon as it is taken', icon: 'check' },
      { text: 'Treat every inquiry with equal respect regardless of background', icon: 'heart' },
    ],
    donts: [
      { text: 'Don\'t post fake or placeholder listings to "test the market"', icon: 'alert' },
      { text: 'Don\'t bait-and-switch — the listed price is the final price', icon: 'currency' },
      { text: 'Don\'t ask tenants to pay deposit or rent outside the platform', icon: 'shield' },
      { text: 'Don\'t discriminate based on religion, caste, gender, or marital status', icon: 'block' },
      { text: 'Don\'t list the same property multiple times to game visibility', icon: 'copy' },
      { text: 'Don\'t share tenant contact details with third parties', icon: 'lock' },
    ],
  },
  tenants: {
    summary: 'Be genuine, show up, communicate. Owners invest time in every inquiry.',
    dos: [
      { text: 'Inquire only if you have genuine interest in renting', icon: 'heart' },
      { text: 'Be honest about your occupation, family size, and move-in timeline', icon: 'user' },
      { text: 'Show up on time for property visits — or cancel in advance', icon: 'clock' },
      { text: 'Raise maintenance issues through the platform', icon: 'tool' },
      { text: 'Report suspicious or misleading listings immediately', icon: 'flag' },
      { text: 'Pay rent and deposits only through the platform for your own protection', icon: 'shield' },
    ],
    donts: [
      { text: 'Don\'t use the platform to window-shop with no intent to rent', icon: 'block' },
      { text: 'Don\'t ask owners to negotiate commission for third parties', icon: 'currency' },
      { text: 'Don\'t share your Aadhaar, PAN, or bank details outside the platform', icon: 'lock' },
      { text: 'Don\'t ghost after a visit — a polite "not interested" goes a long way', icon: 'chat' },
      { text: 'Don\'t pressure owners into lowering prices through fake competing offers', icon: 'alert' },
      { text: 'Don\'t misuse saved listings to scrape contact info', icon: 'shield' },
    ],
  },
  brokers: {
    summary: 'Property managers with owner authorization are welcome. Commission demands are not.',
    dos: [
      { text: 'Property managers with written owner authorization may list on their behalf', icon: 'doc' },
      { text: 'Clearly disclose that you are managing on behalf of the owner', icon: 'user' },
      { text: 'Follow all owner rules when acting as an authorized manager', icon: 'check' },
      { text: 'Contact us at hello@stayonmap.com to register as a property manager', icon: 'mail' },
    ],
    donts: [
      { text: 'Don\'t list properties you don\'t own or aren\'t authorized to manage', icon: 'block' },
      { text: 'Don\'t demand commission from tenants — this platform is 100% free for tenants', icon: 'currency' },
      { text: 'Don\'t pose as a direct owner when you are acting as an intermediary', icon: 'alert' },
      { text: 'Don\'t use StayOnMap as a lead generation tool to funnel tenants elsewhere', icon: 'block' },
      { text: 'Don\'t ask for cash, UPI transfers, or any payment outside the platform', icon: 'shield' },
    ],
    warning: 'If a tenant files a complaint against you for demanding extra cash or unauthorized commission, your account will be permanently banned — no warnings, no appeals.',
    note: 'StayOnMap was built to remove the practice of demanding months of hard-earned rent as commission. Brokers who act in good faith as authorized property managers are welcome.',
  },
}

// ── Icons ───────────────────────────────────────────────────────────
const ICON_PATHS = {
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  camera:   'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z',
  currency: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  clock:    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
  check:    'M20 6L9 17l-5-5',
  heart:    'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  alert:    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  block:    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M4.93 4.93l14.14 14.14',
  copy:     'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M8 2h8v4H8z',
  lock:     'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4',
  user:     'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  tool:     'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  flag:     'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
  chat:     'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  doc:      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  mail:     'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
}

function RuleIcon({ name, size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={ICON_PATHS[name] ?? ICON_PATHS.check} />
    </svg>
  )
}

// ── Components ──────────────────────────────────────────────────────
function RuleItem({ rule, _index, type }) {
  const isDo = type === 'do'
  return (
    <div className="flex items-start gap-3 group">
      <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        isDo ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200' : 'bg-red-100 text-red-500 group-hover:bg-red-200'
      }`}>
        <RuleIcon name={rule.icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-relaxed">{rule.text}</p>
      </div>
    </div>
  )
}

function RuleSection({ title, subtitle, items, type }) {
  const isDo = type === 'do'
  return (
    <div className={`rounded-xl border p-5 sm:p-6 ${isDo ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'}`}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDo ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {isDo ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((rule, i) => (
          <RuleItem key={i} rule={rule} index={i} type={type} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ number, label }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold text-white">{number}</p>
      <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">{label}</p>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────
export default function RulesPage() {
  const [active, setActive] = useState('owners')
  const rules = RULES[active]
  const persona = PERSONAS.find(p => p.id === active)

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <SEOMeta
        title="Community Rules"
        description="How owners, tenants, and brokers are expected to behave on StayOnMap — honest listings, zero commission demands, real trust."
        canonical={canonical('/rules')}
      />
      <div className="h-16" />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative bg-[#111111] px-4 sm:px-6 pt-14 pb-16 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 65%)', transform: 'translate(30%, -50%)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #ff8c42 0%, transparent 65%)', transform: 'translate(-20%, 40%)' }} />
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/60 text-[11px] font-semibold mb-5 tracking-widest uppercase">
            Community Guidelines
          </span>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white leading-tight tracking-tight mb-3">
            Fair rules. Real homes.<br />
            <span className="text-brand-400">Zero brokerage.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
            These guidelines protect everyone on StayOnMap — owners, tenants, and every listing on the platform.
          </p>

          {/* Stats strip */}
          <div className="flex items-center justify-center gap-8 sm:gap-14 mt-8 mb-10">
            <StatCard number="0%" label="Commission" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard number="100%" label="Transparency" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard number="24hr" label="Response" />
          </div>

          {/* Tab switcher */}
          <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-2xl p-1 gap-0.5">
            {PERSONAS.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  active === id
                    ? 'bg-white text-[#111111] shadow-md'
                    : 'text-white/50 hover:text-white/80',
                ].join(' ')}
              >
                <span className="text-base leading-none">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rules content ───────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Persona header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-sm shrink-0">
            {persona.emoji}
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">Rules for {persona.label}</h2>
            <p className="text-sm text-slate-400">{persona.tagline}</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f4511e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">In short</p>
            <p className="text-sm text-slate-600 leading-relaxed">{rules.summary}</p>
          </div>
        </div>

        {/* Broker context note */}
        {rules.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-amber-800 leading-relaxed">{rules.note}</p>
          </div>
        )}

        {/* Lifetime ban warning */}
        {rules.warning && (
          <div className="bg-red-600 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">Zero tolerance</p>
              <p className="text-sm text-white font-medium leading-relaxed">{rules.warning}</p>
            </div>
          </div>
        )}

        {/* Dos & Don'ts grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <RuleSection
            title="You should"
            subtitle={`${rules.dos.length} guidelines`}
            items={rules.dos}
            type="do"
          />
          <RuleSection
            title="You must not"
            subtitle={`${rules.donts.length} restrictions`}
            items={rules.donts}
            type="dont"
          />
        </div>

        {/* Community pledge */}
        <div className="rounded-2xl bg-[#111111] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0">🤝</div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-base text-white mb-1">The StayOnMap Pledge</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                By using StayOnMap you agree to act with honesty, fairness, and respect. Violations lead to listing removal and account bans.
              </p>
            </div>
            <Link
              to="/contact"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors no-underline whitespace-nowrap"
            >
              Report a violation
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
