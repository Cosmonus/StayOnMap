// Single labeled input (number or date) bound to one filter id.
export default function FieldRow({ label, type = 'number', unit, placeholder, value, onChange }) {
  const isNumber = type === 'number'
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative w-40 shrink-0">
        {unit && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{unit}</span>}
        <input
          type={type}
          min={isNumber ? '0' : undefined}
          inputMode={isNumber ? 'numeric' : undefined}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            if (!isNumber) return onChange(e.target.value)
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }}
          className={`w-full h-10 ${unit ? 'pl-8' : 'pl-3'} pr-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
        />
      </div>
    </div>
  )
}
