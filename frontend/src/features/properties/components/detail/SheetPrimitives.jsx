// ── The listing sheet ────────────────────────────────────────────────────────
// One card, hairline-divided, instead of a stack of separate cards. The old
// layout gave every section its own border and shadow, so nine equally-loud
// panels competed for attention and the page read as longer than it was.
export function Sheet({ children }) {
  return <div className="rounded-2xl border border-slate-100 bg-white px-5 sm:px-7">{children}</div>
}

// `first:border-t-0` keys off the rendered DOM, so a section that conditions
// itself away never leaves a stray rule at the top of the sheet.
export function SheetSection({ id, title, badge, subtitle, action, children }) {
  return (
    <section id={id} className="border-t border-slate-100 py-6 first:border-t-0">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
              {badge != null && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{badge}</span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function FactCell({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  )
}

export function PriceRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
