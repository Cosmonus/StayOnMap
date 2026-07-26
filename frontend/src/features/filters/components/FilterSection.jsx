// Collapsible filter section. Deliberately borderless — structure is carried
// by whitespace and a single hairline between sections, so the only boxes in
// the modal are the interactive elements themselves (chips, inputs). Open
// state reads from the flipped chevron, the darker title, and the content.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FilterSection({ label, activeCount, defaultOpen = false, onClear, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-4 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
      >
        <span className="flex items-center gap-2.5">
          <span className={`text-[15px] font-semibold transition-colors ${open ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
            {label}
          </span>
          {activeCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#111111] text-white text-[11px] font-bold flex items-center justify-center">
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
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
            >
              Clear
            </span>
          )}
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
            <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </span>
        </span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 pb-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
