// Text input primitive
// Props: label, error, prefix, suffix

export default function Input({ label, error, prefix, suffix, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-slate-500 text-sm">{prefix}</span>}
        <input
          className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 transition-colors ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''} ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        />
        {suffix && <span className="absolute right-3 text-slate-500 text-sm">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
