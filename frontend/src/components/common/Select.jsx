// Custom dropdown — replaces a native <select> (whose open option list can't
// be styled at all, just renders the OS/browser default). Portal-based, same
// visual language as CityDropdown.jsx's floating panel.
// Props: label, error, options [{ value, label, hint? }], placeholder, value, onChange(value), disabled
//
// `hint` renders as a muted second line inside the panel and nothing in the
// trigger — it's for choices that need a word of explanation to pick between
// ("Villa — premium standalone home"), which is why the listing wizard can use
// this instead of a row of pills.
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
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // Fixed-position panels must fit the viewport they're pinned to: a panel
  // that extends past the bottom of a short screen cannot be scrolled to — it
  // simply isn't there (this hid the signup city list on small windows). So:
  // flip upward when below is cramped, cap the height to the space that
  // actually exists, clamp inside the horizontal edges, and recompute on any
  // scroll/resize (capture phase, so a scrolling modal panel counts too) —
  // the old one-shot position went stale the moment the page moved under it.
  useEffect(() => {
    if (!open) { setPos(null); return }

    function computePos() {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const GAP = 6, MARGIN = 8, PANEL_MAX = 256
      const below = vh - r.bottom - GAP - MARGIN
      const above = r.top - GAP - MARGIN
      const openUp = below < 160 && above > below
      const maxHeight = Math.max(120, Math.min(PANEL_MAX, openUp ? above : below))
      const left = Math.max(MARGIN, Math.min(r.left, vw - r.width - MARGIN))
      setPos(openUp
        ? { left, width: r.width, maxHeight, bottom: vh - r.top + GAP }
        : { left, width: r.width, maxHeight, top: r.bottom + GAP })
    }

    computePos()
    window.addEventListener('resize', computePos)
    window.addEventListener('scroll', computePos, true)
    return () => {
      window.removeEventListener('resize', computePos)
      window.removeEventListener('scroll', computePos, true)
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
            // py-3/rounded-xl so a dropdown lines up with the text inputs
            // beside it and clears the 44px target minimum (was py-2.5 and
            // rounded-lg — both off the documented spacing/radius scale).
            'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-150',
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

        {open && pos && createPortal(
          <div
            ref={panelRef}
            // zIndex above the login modal's 9999 — a tie leaves paint order
            // to DOM position, which is how the city list vanished behind it.
            style={{ position: 'fixed', ...pos, zIndex: 10000 }}
            className="bg-white rounded-xl shadow-float border border-slate-200 overflow-y-auto"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePick(opt.value)}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition-colors',
                    isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50 font-medium',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.hint && <span className="block text-xs font-normal text-slate-500 mt-0.5">{opt.hint}</span>}
                  </span>
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
