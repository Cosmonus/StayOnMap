// Toggle switch
// Props: checked, onChange, label, disabled

export default function Toggle({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = '',
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-fast ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  )
}
