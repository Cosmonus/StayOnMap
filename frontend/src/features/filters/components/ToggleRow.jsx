export default function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="min-h-[44px] w-full flex items-center justify-between gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
    >
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors duration-200 ${checked ? 'bg-[#111111]' : 'bg-slate-200'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}
