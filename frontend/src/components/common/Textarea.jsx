// Multi-line text input matching Input style
// Props: label, error, rows

export default function Textarea({
  label,
  error,
  rows = 3,
  className = '',
  ...props
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        rows={rows}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-y focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 transition-colors ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
