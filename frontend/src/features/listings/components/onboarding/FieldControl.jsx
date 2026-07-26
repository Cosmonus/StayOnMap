import Select from '@components/common/Select'

// Generic renderer for a FIELDS / TERMS config entry (config/onboarding.js).
// Control kinds: seg (single-select), count (+/- stepper), txt (text/number +
// optional suffix), two (two `txt` fields side by side), date, num. Nothing
// here knows what a property is — add a kind, not a special case.
//
// `seg` renders as a DROPDOWN, not a row of pills (changed 2026-07-26). Six
// single-choice questions on step 1 meant six rows of wrapping pills — a
// four-option facing control ate a full row, and "Unfurnished" broke mid-word
// inside its own chip. One-tap-vs-two is a real cost, but not next to a step
// that scrolled for what fits in a screen. Multi-select stays chips (see the
// amenity grid on step 4) — that's a different question and a different
// control.

// The config carries option tuples ([value, label]); DESCRIBE carries a third
// hint element, which Select renders as a muted second line.
export function toSelectOptions(opts) {
  return opts.map(([value, label, hint]) => ({ value, label, hint }))
}

function Count({ value, onChange, label }) {
  const n = value ?? 0
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, n - 1))}
        disabled={n <= 0}
        aria-label={`Decrease ${label}`}
        className="w-10 h-10 rounded-full border border-slate-200 text-slate-700 text-lg font-semibold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        –
      </button>
      <span className="font-mono text-lg font-semibold w-6 text-center" aria-live="polite">{n}</span>
      <button
        type="button"
        onClick={() => onChange(n + 1)}
        aria-label={`Increase ${label}`}
        className="w-10 h-10 rounded-full border border-slate-200 text-slate-700 text-lg font-semibold flex items-center justify-center hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        +
      </button>
    </div>
  )
}

export function Txt({ value, onChange, onBlur, ph, suf, type = 'text', label }) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={ph}
        aria-label={label}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500 transition-colors"
        style={{ paddingRight: suf ? 56 : undefined }}
      />
      {suf && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 pointer-events-none">{suf}</span>}
    </div>
  )
}

export function FieldLabel({ children }) {
  return <p className="text-sm font-medium text-slate-700 mb-2">{children}</p>
}

// How wide a field wants to be in the step's grid. Every control is now one
// input-sized box, so only the paired `two` row needs more than a single cell.
export function fieldSpan(f) {
  return f.t === 'two' ? 'sm:col-span-2' : ''
}

export default function FieldControl({ field: f, values, onChange }) {
  if (f.t === 'two') {
    const [aKey, aLabel, aPh] = f.a
    const [bKey, bLabel, bPh] = f.b
    return (
      <div>
        <FieldLabel>{f.label}</FieldLabel>
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <Txt value={values[aKey]} onChange={(v) => onChange(aKey, v)} ph={aPh} label={aLabel} />
            <p className="text-xs text-slate-500 mt-1.5">{aLabel}</p>
          </div>
          <div className="flex-1 min-w-0">
            <Txt value={values[bKey]} onChange={(v) => onChange(bKey, v)} ph={bPh} label={bLabel} />
            <p className="text-xs text-slate-500 mt-1.5">{bLabel}</p>
          </div>
        </div>
      </div>
    )
  }

  const body =
    f.t === 'seg'   ? <Select value={values[f.field]} onChange={(v) => onChange(f.field, v)} options={toSelectOptions(f.opts)} placeholder="Select…" /> :
    f.t === 'count' ? <Count value={values[f.field]} onChange={(v) => onChange(f.field, v)} label={f.label} /> :
    f.t === 'txt'   ? <Txt value={values[f.field]} onChange={(v) => onChange(f.field, v)} ph={f.ph} suf={f.suf} label={f.label} /> :
    null

  return (
    <div>
      <FieldLabel>{f.label}</FieldLabel>
      {body}
    </div>
  )
}
