import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Wrench, ShieldCheck, Truck, Plus, ArrowRight, Sparkles, ChefHat, Baby, Car, HandHelping, Zap, Droplets, Package } from 'lucide-react'
import SEOMeta from '@components/common/SEOMeta'
import { toast } from '@components/common/Toaster'
import { canonical } from '@lib/seo'

const SERVICES = [
  {
    title: 'Rental agreements',
    body: 'Generate and e-sign legally sound rental agreements in minutes.',
    icon: <FileText size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Home cleaning & repairs',
    body: 'On-demand cleaning, painting and repair pros — rated by real tenants.',
    icon: <Wrench size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Tenant verification',
    body: 'Fast, privacy-first identity and background checks for owners.',
    icon: <ShieldCheck size={22} strokeWidth={1.7} />,
  },
  {
    title: 'House maid',
    body: 'Trusted, background-checked house help for daily or part-time work.',
    icon: <Sparkles size={22} strokeWidth={1.7} />,
  },
  {
    title: 'House cook',
    body: 'Home cooks for daily meals or occasions — veg, non-veg, regional cuisines.',
    icon: <ChefHat size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Baby sitting',
    body: 'Verified, experienced sitters and nannies for hourly or full-day care.',
    icon: <Baby size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Mechanics',
    body: 'Two-wheeler and car mechanics who come to your parking spot.',
    icon: <Car size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Helpers',
    body: 'An extra pair of hands — shifting, lifting, errands and odd jobs.',
    icon: <HandHelping size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Electricians',
    body: 'Licensed electricians for fittings, faults and appliance installs.',
    icon: <Zap size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Plumbers',
    body: 'Leaks, blockages, geysers and bathroom fittings — fixed same day.',
    icon: <Droplets size={22} strokeWidth={1.7} />,
  },
  {
    title: 'Packers & movers',
    body: 'Door-to-door shifting with careful packing and honest pricing.',
    icon: <Package size={22} strokeWidth={1.7} />,
  },
]

function ServiceCard({ title, body, icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 p-7 flex flex-col min-h-[220px] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="font-mono text-[10px] font-semibold tracking-widest text-slate-400">SOON</span>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 tracking-tight mt-5">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mt-2">{body}</p>
      <button
        onClick={() => toast.success('Got it', "We'll notify you when this launches.")}
        className="flex items-center gap-1.5 mt-auto pt-5 text-sm font-medium text-slate-400 hover:text-brand-600 transition-colors"
      >
        Notify me <span className="text-base leading-none">›</span>
      </button>
    </div>
  )
}

export default function ServicesPage() {
  const [email, setEmail] = useState('')

  function handleWaitlistSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    toast.success('You’re on the list', "We'll email you when services open in your city.")
    setEmail('')
  }

  return (
    <>
      <SEOMeta
        title="Services — Coming Soon"
        description="StayOnMap Services will bring broker-free moving, rental agreements, home repairs, and tenant verification into one place. Coming soon."
        canonical={canonical('/services')}
      />

      <main className="min-h-screen bg-white pt-28 md:pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">

          {/* Hero */}
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-700 text-xs font-bold px-4 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
              Coming soon
            </span>
            <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-tight tracking-tight mt-5">
              Everything after the keys.
            </h1>
            <p className="text-slate-500 text-base md:text-lg leading-relaxed mt-5">
              We&apos;re building broker-free services around your rental — moving, agreements,
              repairs and verification, all in one place. No middlemen, no markups.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
            {/* Feature card — spans both rows on desktop */}
            <div className="md:row-span-2 rounded-3xl bg-[#111111] text-white p-9 flex flex-col relative overflow-hidden min-h-[220px]">
              <div
                className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(2,132,199,0.55), transparent 70%)' }}
              />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Truck size={24} color="#fff" strokeWidth={1.6} />
                </div>
                <span className="font-mono text-[10px] font-semibold tracking-widest text-white/50">FIRST TO LAUNCH</span>
              </div>
              <div className="mt-auto pt-16 md:pt-28 relative z-10">
                <h3 className="text-2xl font-semibold tracking-tight">Verified movers &amp; packers</h3>
                <p className="text-sm leading-relaxed text-white/70 mt-2.5 max-w-xs">
                  Book background-checked moving crews with upfront, broker-free pricing. Rated by
                  the tenants who used them.
                </p>
                <div className="flex gap-2 flex-wrap mt-5">
                  <span className="text-xs font-medium text-white/85 bg-white/10 rounded-full px-3 py-1.5">Fixed quotes</span>
                  <span className="text-xs font-medium text-white/85 bg-white/10 rounded-full px-3 py-1.5">Insured crews</span>
                  <span className="text-xs font-medium text-white/85 bg-white/10 rounded-full px-3 py-1.5">Same-week slots</span>
                </div>
              </div>
            </div>

            {SERVICES.map((svc) => (
              <ServiceCard key={svc.title} {...svc} />
            ))}

            {/* Roadmap tile */}
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-7 flex flex-col min-h-[220px]">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-brand-600 flex items-center justify-center">
                  <Plus size={22} strokeWidth={1.7} />
                </div>
                <span className="font-mono text-[10px] font-semibold tracking-widest text-slate-400">ROADMAP</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight mt-5">More on the way</h3>
              <p className="text-sm text-slate-500 leading-relaxed mt-2">
                Renter&apos;s insurance, utility setup, packing supplies and more.
              </p>
              <button
                onClick={() => toast.success('Thanks for the vote!', 'We use this to prioritize what we build next.')}
                className="flex items-center gap-1.5 mt-auto pt-5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Vote for what&apos;s next <span className="text-base leading-none">›</span>
              </button>
            </div>
          </div>

          {/* Waitlist band */}
          <div className="mt-5 rounded-3xl bg-slate-50 border border-slate-100 p-8 md:p-9 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xl font-semibold text-slate-900 tracking-tight">
                Be first in line when services go live.
              </p>
              <p className="text-sm text-slate-500 mt-1.5">
                One email when each service opens in your city. Nothing else.
              </p>
            </div>
            <form onSubmit={handleWaitlistSubmit} className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full md:w-64 h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shrink-0 transition-colors"
              >
                Join the waitlist
              </button>
            </form>
          </div>

          {/* Browse CTA */}
          <div className="flex justify-center mt-10">
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 hover:border-slate-400 text-slate-900 text-sm font-semibold px-6 py-3 no-underline transition-colors"
            >
              Browse rentals on the map
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
