// Collapsible filter section, styled as a distinct card so open/closed and
// active/inactive states are visually obvious: closed cards sit on a muted
// background, the open card lifts to white with a shadow and a divider
// under its header.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FilterSection({ label, activeCount, defaultOpen = false, onClear, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        open
          ? 'border-slate-300 bg-white shadow-sm'
          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl"
      >
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-800">{label}</span>
          {activeCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 shrink-0">
          {activeCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClear() } }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Clear
            </span>
          )}
          <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-slate-100' : ''}`}>
            <ChevronDown size={15} className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </span>
        </span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-4 pt-4 pb-5 flex flex-col gap-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
