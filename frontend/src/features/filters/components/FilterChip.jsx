export default function FilterChip({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
        active
          ? 'bg-[#111111] text-white border-[#111111]'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {icon && <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}>{icon}</span>}
      {label}
    </button>
  )
}
