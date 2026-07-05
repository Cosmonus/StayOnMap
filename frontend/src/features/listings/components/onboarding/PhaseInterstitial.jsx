const ART = {
  1: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  2: 'M12 2l2.9 6.3L22 9.3l-5 4.7 1.3 6.9L12 17.8 5.7 20.9 7 14 2 9.3l7.1-1z',
  3: 'M9 12l2 2 4-4M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
}

export default function PhaseInterstitial({ n, title, blurb }) {
  return (
    <div className="flex gap-10 items-center flex-wrap py-5">
      <div className="flex-1 min-w-[260px]">
        <p className="font-display text-6xl font-semibold text-brand-100 leading-none">0{n}</p>
        <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1.5 mb-3.5">Step {n} of 3</p>
        <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight leading-tight">{title}</h1>
        <p className="text-base text-slate-500 leading-relaxed mt-4 max-w-md">{blurb}</p>
      </div>
      <div className="shrink-0 w-56 h-56 rounded-3xl bg-brand-50 flex items-center justify-center">
        <svg width="88" height="88" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {ART[n].split('M').filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
        </svg>
      </div>
    </div>
  )
}
