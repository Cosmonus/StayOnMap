// Dual-thumb range slider — two stacked native <input type="range">
// (thumb-only pointer events via .range-slider-input in index.css), so it's
// keyboard-accessible for free. A thumb parked at either end of the domain
// means "no constraint" (null), matching the min/max inputs' semantics.
function fmt(n, unit) {
  if (unit === '₹') {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 ? 1 : 0)}Cr`
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 ? 1 : 0)}L`
    if (n >= 1000) return `₹${Math.round(n / 1000)}k`
    return `₹${n}`
  }
  return unit ? `${n.toLocaleString('en-IN')} ${unit}` : n.toLocaleString('en-IN')
}

export default function RangeSlider({ domain, unit, min, max, onChange }) {
  const { min: dMin, max: dMax, step } = domain
  const lo = Math.min(Math.max(min ?? dMin, dMin), dMax)
  const hi = Math.min(Math.max(max ?? dMax, dMin), dMax)
  const pct = (v) => ((v - dMin) / (dMax - dMin)) * 100

  function changeLo(raw) {
    const v = Math.min(Number(raw), hi)
    onChange({ min: v <= dMin ? null : v, max })
  }
  function changeHi(raw) {
    const v = Math.max(Number(raw), lo)
    onChange({ min, max: v >= dMax ? null : v })
  }

  return (
    <div>
      <div className="relative h-6 mx-2.5">
        {/* Track + filled segment */}
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-[#111111]"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range" className="range-slider-input" aria-label="Minimum"
          min={dMin} max={dMax} step={step} value={lo}
          onChange={(e) => changeLo(e.target.value)}
        />
        <input
          type="range" className="range-slider-input" aria-label="Maximum"
          min={dMin} max={dMax} step={step} value={hi}
          onChange={(e) => changeHi(e.target.value)}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs font-medium text-slate-500">
        <span>{fmt(lo, unit)}</span>
        <span>{hi >= dMax ? `${fmt(dMax, unit)}+` : fmt(hi, unit)}</span>
      </div>
    </div>
  )
}
