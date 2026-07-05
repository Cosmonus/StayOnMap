import { Home, Star, ShieldCheck } from 'lucide-react'

const ART = { 1: Home, 2: Star, 3: ShieldCheck }

export default function PhaseInterstitial({ n, title, blurb }) {
  const Art = ART[n]
  return (
    <div className="flex gap-10 items-center flex-wrap py-5">
      <div className="flex-1 min-w-[260px]">
        <p className="font-display text-6xl font-semibold text-brand-100 leading-none">0{n}</p>
        <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1.5 mb-3.5">Step {n} of 3</p>
        <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight leading-tight">{title}</h1>
        <p className="text-base text-slate-500 leading-relaxed mt-4 max-w-md">{blurb}</p>
      </div>
      <div className="shrink-0 w-56 h-56 rounded-3xl bg-brand-50 flex items-center justify-center">
        <Art size={88} color="#0284c7" strokeWidth={1.3} />
      </div>
    </div>
  )
}
