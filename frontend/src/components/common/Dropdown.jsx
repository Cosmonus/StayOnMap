import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Dropdown({
  label,
  fieldIcon,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (!triggerRef.current?.closest('[data-dropdown]')?.contains(e.target)) setOpen(false)
    }
    function onEsc(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onEsc) }
  }, [open])

  function handleToggle() {
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: Math.max(rect.width, 220) })
    setOpen(v => !v)
  }

  const selected = options.find(o => o.value === value)
  const hasValue = !!selected?.value

  return (
    <div className="relative flex-1 min-w-0" data-dropdown ref={triggerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-full px-5 py-4 flex flex-col items-start gap-0.5 outline-none transition-colors rounded-2xl ${open ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {fieldIcon}
          {label}
        </span>
        <div className="flex items-center justify-between w-full gap-2">
          <span className={`text-sm truncate ${hasValue ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'}`}>
            {hasValue ? selected.label : placeholder}
          </span>
          <svg className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {open && createPortal(
        <div
          style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-down"
          role="listbox"
        >
          {options.map(option => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(option.value); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                  isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                {option.icon && (
                  <span className={`shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`}>{option.icon}</span>
                )}
                <span className="flex-1">{option.label}</span>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
