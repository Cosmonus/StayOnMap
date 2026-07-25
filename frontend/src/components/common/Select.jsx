// Custom dropdown — replaces a native <select> (whose open option list can't
// be styled at all, just renders the OS/browser default). Portal-based, same
// visual language as CityDropdown.jsx's floating panel.
// Props: label, error, options [{ value, label }], placeholder, value, onChange(value), disabled
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export default function Select({
  label,
  error,
  options = [],
  placeholder = 'Select…',
  value,
  onChange,
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
  }, [open])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onOutside(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current   && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [])

  const selected = options.find((o) => o.value === value)

  function handlePick(optionValue) {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div ref={triggerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={[
            'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all duration-150',
            disabled
              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
              : open
                ? 'border-brand-600 bg-white ring-2 ring-brand-500/20'
                : 'border-slate-300 bg-white hover:border-slate-400',
            error ? 'border-red-400' : '',
            className,
          ].join(' ')}
        >
          <span className={`truncate text-left ${selected ? 'text-slate-800' : 'text-slate-500'}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
            className="bg-white rounded-xl shadow-float border border-slate-200 overflow-hidden max-h-64 overflow-y-auto"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePick(opt.value)}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left transition-colors',
                    isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50 font-medium',
                  ].join(' ')}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={13} strokeWidth={2.5} className="shrink-0" />}
                </button>
              )
            })}
            {options.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-500 text-center">No options</p>
            )}
          </div>,
          document.body
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
