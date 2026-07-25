// Generic renderer for a FIELDS config entry (config/onboarding.js) — mirrors
// the source design's 4 control types exactly: seg (segmented single-select),
// count (+/- stepper), txt (text/number + optional suffix), two (two `txt`
// fields side by side).

function Seg({ value, onChange, opts }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([val, label]) => {
        const on = value === val
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Count({ value, onChange }) {
  const n = value ?? 0
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, n - 1))}
        disabled={n <= 0}
        aria-label="Decrease"
        className="w-10 h-10 rounded-full border border-slate-200 text-slate-700 text-lg font-semibold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400"
      >
        <span aria-hidden="true">–</span>
      </button>
      <span className="font-mono text-lg font-semibold w-6 text-center" aria-live="polite">{n}</span>
      <button
        type="button"
        onClick={() => onChange(n + 1)}
        aria-label="Increase"
        className="w-10 h-10 rounded-full border border-slate-200 text-slate-700 text-lg font-semibold flex items-center justify-center hover:border-slate-400"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}

function Txt({ value, onChange, ph, suf }) {
  return (
    <div className="relative max-w-xs">
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"
        style={{ paddingRight: suf ? 44 : undefined }}
      />
      {suf && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">{suf}</span>}
    </div>
  )
}

export default function FieldControl({ field: f, values, onChange }) {
  if (f.t === 'two') {
    const [aKey, aLabel, aPh] = f.a
    const [bKey, bLabel, bPh] = f.b
    return (
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <p className="text-xs text-slate-500 mb-1.5">{aLabel}</p>
          <Txt value={values[aKey]} onChange={(v) => onChange(aKey, v)} ph={aPh} />
        </div>
        <div className="flex-1 min-w-[140px]">
          <p className="text-xs text-slate-500 mb-1.5">{bLabel}</p>
          <Txt value={values[bKey]} onChange={(v) => onChange(bKey, v)} ph={bPh} />
        </div>
      </div>
    )
  }

  const body =
    f.t === 'seg'   ? <Seg value={values[f.field]} onChange={(v) => onChange(f.field, v)} opts={f.opts} /> :
    f.t === 'count' ? <Count value={values[f.field]} onChange={(v) => onChange(f.field, v)} /> :
    f.t === 'txt'   ? <Txt value={values[f.field]} onChange={(v) => onChange(f.field, v)} ph={f.ph} suf={f.suf} /> :
    null

  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-slate-800 mb-2.5">{f.label}</p>
      {body}
    </div>
  )
}
