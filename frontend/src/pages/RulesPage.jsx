import { useState } from 'react'
import {
  Shield, Camera, IndianRupee, Clock, Check, Heart, TriangleAlert, Ban,
  Copy, Lock, User, Wrench, Flag, MessageSquare, FileText, Mail, X, Info, CircleAlert,
} from 'lucide-react'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { SUPPORT_EMAIL } from '@/config/support'
import { CITIES } from '@/config/cities'

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
      { text: 'List only properties you own or are legally authorized to rent out — verify ownership to earn the Verified badge', icon: 'shield' },
      { text: 'Complete your profile before listing — name, phone, city, and a verified email are required to host', icon: 'user' },
      { text: 'Upload real photos — at least 3 clear images of the actual property', icon: 'camera' },
      { text: 'State the exact rent — or lump-sum lease amount — deposit, and maintenance charges upfront', icon: 'currency' },
      { text: 'Respond to tenant inquiries within 48 hours', icon: 'clock' },
      { text: 'Reply to reviews and reports on your listing — your response is shown alongside them', icon: 'chat' },
      { text: 'Mark your listing as rented as soon as it is taken', icon: 'check' },
      { text: 'Treat every inquiry with equal respect regardless of background', icon: 'heart' },
    ],
    donts: [
      { text: 'Don\'t post fake or placeholder listings to "test the market"', icon: 'alert' },
      { text: 'Don\'t bait-and-switch — the listed price is the final price', icon: 'currency' },
      { text: 'Don\'t demand token money or any fee just to show the property', icon: 'shield' },
      { text: 'Don\'t discriminate based on religion, caste, gender, or marital status', icon: 'block' },
      { text: 'Don\'t list the same property multiple times to game visibility — duplicates are detected and raise your risk score', icon: 'copy' },
      { text: 'Don\'t share tenant contact details with third parties', icon: 'lock' },
    ],
  },
  tenants: {
    summary: 'Be genuine, show up, communicate. Owners invest time in every inquiry.',
    dos: [
      { text: 'Inquire only if you have genuine interest in renting', icon: 'heart' },
      { text: 'Be honest about your occupation, family size, and move-in timeline', icon: 'user' },
      { text: 'Book visits through in-app appointments — and show up on time, or cancel in advance', icon: 'clock' },
      { text: 'Keep conversations in the in-app chat — it protects both sides if something goes wrong', icon: 'shield' },
      { text: 'Report suspicious or misleading listings immediately — anonymously if you prefer', icon: 'flag' },
      { text: 'Write an honest review after living somewhere — it\'s what the next renter relies on', icon: 'chat' },
    ],
    donts: [
      { text: 'Don\'t use the platform to window-shop with no intent to rent', icon: 'block' },
      { text: 'Don\'t ask owners to negotiate commission for third parties', icon: 'currency' },
      { text: 'Don\'t share identity documents or bank details with anyone — StayOnMap never asks for them', icon: 'lock' },
      { text: 'Don\'t ghost after a visit — a polite "not interested" goes a long way', icon: 'chat' },
      { text: 'Don\'t pressure owners into lowering prices through fake competing offers', icon: 'alert' },
      { text: 'Don\'t post fake reviews — for or against a property', icon: 'shield' },
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
      { text: 'Don\'t ask tenants for cash, UPI transfers, or any payment in exchange for access to a listing', icon: 'shield' },
    ],
    warning: 'If a tenant files a complaint against you for demanding extra cash or unauthorized commission, your account will be permanently banned — no warnings, no appeals.',
    note: 'StayOnMap was built to remove the practice of demanding months of hard-earned rent as commission. Brokers who act in good faith as authorized property managers are welcome.',
  },
}

// ── Icons ───────────────────────────────────────────────────────────
const RULE_ICONS = {
  shield: Shield, camera: Camera, currency: IndianRupee, clock: Clock,
  check: Check, heart: Heart, alert: TriangleAlert, block: Ban, copy: Copy,
  lock: Lock, user: User, tool: Wrench, flag: Flag, chat: MessageSquare,
  doc: FileText, mail: Mail,
}

function RuleIcon({ name, size = 14, className = '' }) {
  const IconComp = RULE_ICONS[name] ?? Check
  return <IconComp size={size} className={className} strokeWidth={2} />
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
          {isDo ? <Check size={18} color="white" strokeWidth={3} /> : <X size={18} color="white" strokeWidth={3} />}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
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
      <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-medium">{label}</p>
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
        description="How owners, tenants, and property managers are expected to behave on StayOnMap — honest listings, moderated reports (anonymous welcome), zero commission demands."
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
          <p className="text-slate-500 text-sm leading-relaxed max-w-lg mx-auto">
            These guidelines protect everyone on StayOnMap — owners, tenants, and every listing on the platform.
          </p>

          {/* Stats strip */}
          <div className="flex items-center justify-center gap-8 sm:gap-14 mt-8 mb-10">
            <StatCard number="0%" label="Commission" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard number="100%" label="Transparency" />
            <div className="w-px h-10 bg-white/10" />
            <StatCard number={String(CITIES.length)} label="Cities live" />
          </div>

          {/* Tab switcher */}
          <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-2xl p-1 gap-0.5">
            {PERSONAS.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={[
                  'flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
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
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0">
            {persona.emoji}
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">Rules for {persona.label}</h2>
            <p className="text-sm text-slate-500">{persona.tagline}</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
            <Info size={14} color="#f4511e" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">In short</p>
            <p className="text-sm text-slate-600 leading-relaxed">{rules.summary}</p>
          </div>
        </div>

        {/* Broker context note */}
        {rules.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <CircleAlert size={16} color="#d97706" strokeWidth={2} className="shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">{rules.note}</p>
          </div>
        )}

        {/* Lifetime ban warning */}
        {rules.warning && (
          <div className="bg-red-600 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <TriangleAlert size={18} color="white" strokeWidth={2.5} className="shrink-0 mt-0.5" />
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

        {/* How reports are handled */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-10">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <Flag size={18} color="#f4511e" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">How reports are handled</h3>
              <p className="text-[11px] text-slate-500">What actually happens after you hit &quot;report&quot;</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              'Anyone can report a listing — no account needed. Categories cover fraud, fake photos, wrong pricing, unauthorized listings, safety concerns, broker spam, and more.',
              'Every report is reviewed by a human moderator. Reports raise a listing\'s risk score weighted by severity, and dismissed reports stop counting.',
              'You can report anonymously — but identified reports carry more weight: automatic suspension requires reports from identified accounts, so signing in makes your report count for more.',
              'Severe reports can auto-suspend a listing while it\'s under review — no one has to notice first.',
              'Owners see reports on their listings and can respond; the response is shown alongside the report.',
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
                <p className="text-sm text-slate-600 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community pledge */}
        <div className="rounded-2xl bg-[#111111] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0">🤝</div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-base text-white mb-1">The StayOnMap Pledge</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                By using StayOnMap you agree to act with honesty, fairness, and respect. Violations lead to listing removal and account bans.
              </p>
            </div>
            {/* A mail client, not the deleted /contact page. The subject is
                prefilled because this button is the one place someone arrives
                with a violation in mind and no listing in front of them — the
                in-product path for a specific listing is still ReportButton on
                the property page, which files a real PropertyReport. */}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Reporting a violation of the Community Rules')}`}
              className="min-h-[44px] shrink-0 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors no-underline whitespace-nowrap inline-flex items-center"
            >
              Report a violation
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
