// Min/max numeric pair with optional dual-thumb slider and one-tap preset
// chips — all three stay in sync through the same min/max values.
import FilterChip from './FilterChip'
import RangeSlider from './RangeSlider'

function NumberInput({ value, placeholder, unit, onChange }) {
  // ₹ is narrow enough to prefix; longer units (sq.ft, ft) go on the right
  // so they never sit on top of the typed number.
  const prefix = unit === '₹' ? unit : null
  const suffix = unit && unit !== '₹' ? unit : null
  return (
    <div className="relative flex-1">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>}
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{suffix}</span>}
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`w-full h-10 ${prefix ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500`}
      />
    </div>
  )
}

export default function RangeControl({ label, unit, min, max, chips, slider, onChange }) {
  const chipActive = (c) => min === c.min && max === c.max

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      {slider && (
        <div className="mb-3">
          <RangeSlider domain={slider} unit={unit} min={min} max={max} onChange={onChange} />
        </div>
      )}
      {chips && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {chips.map((c) => (
            <FilterChip
              key={c.label}
              label={c.label}
              active={chipActive(c)}
              onClick={() => onChange(chipActive(c) ? { min: null, max: null } : { min: c.min, max: c.max })}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <NumberInput value={min} placeholder="Min" unit={unit} onChange={(v) => onChange({ min: v, max })} />
        <span className="text-slate-300">—</span>
        <NumberInput value={max} placeholder="Max" unit={unit} onChange={(v) => onChange({ min, max: v })} />
      </div>
    </div>
  )
}
