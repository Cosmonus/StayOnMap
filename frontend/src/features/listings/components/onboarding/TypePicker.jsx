import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Home, ChevronLeft } from 'lucide-react'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { CATEGORIES } from '../../config/onboarding.js'

// Shown first if the logged-in user is still a TENANT — listing is an
// explicit "become a host" branch, never automatic.
export function BecomeHostIntro({ onDone }) {
  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => authService.upgradeRole(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('You’re a host now', 'Let’s get your first listing up.')
      onDone()
    },
    onError: (err) => toast.error('Couldn’t upgrade', err.message ?? 'Please try again'),
  })

  return (
    <div className="max-w-lg mx-auto text-center py-10">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
        <Home size={28} color="#0284c7" strokeWidth={1.8} />
      </div>
      <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight mb-3">Become a host on StayOnMap</h1>
      <p className="text-sm text-slate-500 leading-relaxed mb-8">
        Listing a property is a separate role from renting — you&apos;ll keep everything you can
        already do as a tenant, plus the ability to list and manage your own properties.
      </p>
      <button
        type="button"
        onClick={() => mutate()}
        disabled={isPending}
        className="px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Setting up…' : 'Continue as a host'}
      </button>
    </div>
  )
}

// Shown when a non-Business user picks pg/shop/stay — stub upgrade, no real
// payment gateway yet (see roadmap.md P3.2/P3.3).
export function BusinessGate({ onUpgraded, onChooseDifferent }) {
  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => authService.upgradeBusiness(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Welcome to Business', 'You can now list PG, shop and short-stay properties.')
      onUpgraded()
    },
    onError: (err) => toast.error('Couldn’t upgrade', err.message ?? 'Please try again'),
  })

  return (
    <div className="max-w-lg mx-auto text-center py-10">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-bold tracking-wide mb-6">BUSINESS</span>
      <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight mb-3">This property type needs a Business account</h1>
      <p className="text-sm text-slate-500 leading-relaxed mb-8">
        PG, shop/commercial and short-stay listings run through StayOnMap Business — ₹999/mo,
        cancel anytime. (Billing isn&apos;t live yet — this upgrades your account for free while
        we finish that.)
      </p>
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={onChooseDifferent} className="px-5 py-3 rounded-xl border border-slate-200 hover:border-slate-400 text-sm font-semibold text-slate-700 transition-colors">
          Choose a different type
        </button>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isPending}
          className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Upgrading…' : 'Upgrade to Business'}
        </button>
      </div>
    </div>
  )
}

export default function TypePicker({ onPick, onBack }) {
  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={2.2} />
          Back to your listings
        </button>
      )}
      <div className="text-center max-w-xl mx-auto mb-10">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-4">Host onboarding</p>
        <h1 className="font-display font-bold text-3xl md:text-4xl text-slate-900 tracking-tight leading-tight">
          It&apos;s easy to list on <span className="text-brand-600">StayOnMap</span>.
        </h1>
        <p className="text-base text-slate-500 leading-relaxed mt-4">
          Pick what you&apos;re listing. Each type has its own guided onboarding — same three
          phases, different questions and verification.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(CATEGORIES).map(([key, c]) => {
          const biz = c.tier === 'biz'
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className="text-left p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-400 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-150 flex flex-col gap-3 min-h-[168px]"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${biz ? 'bg-slate-900' : 'bg-brand-50'}`}>
                  <Home size={22} color={biz ? '#fff' : '#0284c7'} strokeWidth={1.7} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded-full ${biz ? 'bg-slate-900 text-white' : 'bg-brand-50 text-brand-700'}`}>
                  {biz ? 'BUSINESS' : 'FREE'}
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">{c.label}</p>
                <p className="text-sm text-slate-500 mt-0.5">{c.long}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
