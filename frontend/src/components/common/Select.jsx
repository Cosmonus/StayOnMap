// Custom dropdown — replaces a native <select> (whose open option list can't
// be styled at all, just renders the OS/browser default). Portal-based, same
// visual language as CityDropdown.jsx's floating panel.
// Props: label, hint, error, options [{ value, label, hint? }], placeholder, value, onChange(value), disabled
//
// An option's `hint` renders as a muted second line inside the panel and
// nothing in the trigger — it's for choices that need a word of explanation to
// pick between ("Villa — premium standalone home"), which is why the listing
// wizard can use this instead of a row of pills. The FIELD's `hint` is the
// help line under the control; see the clearance note on PANEL_GAP.
import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

// How long a type-ahead burst stays one word. Below ~400ms a slow typist starts
// a new search mid-word; above ~1.2s an abandoned attempt poisons the next one.
const TYPEAHEAD_MS = 700

// How far below the trigger the floating panel opens. Anything the field
// renders under the control must clear this, or the panel lands mid-line and
// SLICES it instead of covering it — a 2px sliver of help text wedged under
// the dropdown, which is exactly what "the text is overlapping the dropdown"
// looked like when callers hand-rolled a `<p className="mt-1">` sibling. Hence
// `hint` living in here, spaced to clear the gap, rather than at each callsite.
const PANEL_GAP = 6

// gap-1 (4px) from the flex column + mt-1 (4px) = 8px, clear of PANEL_GAP.
const BELOW_CONTROL = 'mt-1 text-xs'

export default function Select({
  id,
  label,
  hint,
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
  // Stable ids so the label, the trigger and the panel can point at each other.
  // A <label htmlFor> cannot target a <button>, so the association is made with
  // aria-labelledby instead — without it a screen reader announced every
  // dropdown in the app as a bare "button", with no idea which field it was.
  const autoId = useId()
  const baseId = id ?? autoId
  const labelId = `${baseId}-label`
  const panelId = `${baseId}-panel`
  const hintId = `${baseId}-hint`
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
      const GAP = PANEL_GAP, MARGIN = 8, PANEL_MAX = 256
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
  const selectedIndex = options.findIndex((o) => o.value === value)

  function handlePick(optionValue) {
    onChange(optionValue)
    setOpen(false)
    // Focus goes back to the trigger, or it is left on a button that just
    // unmounted and the next Tab starts from the top of the document.
    triggerRef.current?.querySelector('button')?.focus()
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  // Added 2026-08-11. Until then the only way to choose was a mouse click on
  // one of the option buttons: no arrows, no Enter, no type-ahead, and the
  // panel always opened scrolled to the TOP.
  //
  // That is a usability problem everywhere and a real one on the long lists.
  // The PG curfew field offers 48 half-hours, so picking 10:30 PM meant opening
  // a list positioned at midnight and scrolling past 45 rows — every time,
  // including when 10:30 PM was already the answer. A native <select>, which
  // this component exists to replace, does all of this for free; replacing it
  // meant owing it.
  //
  // `activeIndex` is the KEYBOARD cursor and is deliberately separate from the
  // selected value: moving through a list must not change the answer until
  // Enter, or arrowing past a field commits whatever it happened to land on.
  const [activeIndex, setActiveIndex] = useState(-1)
  const optionRefs = useRef([])
  const typeahead = useRef({ buffer: '', at: 0 })

  // Opening starts the cursor on the CURRENT value, which is what makes the
  // scroll below land somewhere useful rather than at midnight.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const moveTo = useCallback((next) => {
    if (options.length === 0) return
    // Clamped, not wrapped. Wrapping a 48-item list means one key too many
    // silently teleports from 11:30 PM to midnight, and on a list this long the
    // jump is off-screen — the user sees the value change and not why.
    setActiveIndex(Math.max(0, Math.min(options.length - 1, next)))
  }, [options.length])

  function onTriggerKeyDown(e) {
    if (disabled) return

    // Closed: the keys that OPEN it. Enter/Space are the button's own default.
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveTo(activeIndex + 1); return
      case 'ArrowUp':   e.preventDefault(); moveTo(activeIndex - 1); return
      case 'Home':      e.preventDefault(); moveTo(0); return
      case 'End':       e.preventDefault(); moveTo(options.length - 1); return
      case 'PageDown':  e.preventDefault(); moveTo(activeIndex + 5); return
      case 'PageUp':    e.preventDefault(); moveTo(activeIndex - 5); return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (options[activeIndex]) handlePick(options[activeIndex].value)
        return
      case 'Tab':
        // Tab commits and moves on, matching a native select. Closing without
        // committing would silently discard a choice the user believes they
        // made — they can see it highlighted.
        if (options[activeIndex]) onChange(options[activeIndex].value)
        setOpen(false)
        return
      default: break
    }

    // Type-ahead. Single printable characters only: modifier combinations are
    // shortcuts, not text.
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
    const now = Date.now()
    const t = typeahead.current
    t.buffer = now - t.at > TYPEAHEAD_MS ? e.key : t.buffer + e.key
    t.at = now
    const q = t.buffer.toLowerCase()
    const hit = options.findIndex((o) => String(o.label).toLowerCase().startsWith(q))
    if (hit >= 0) {
      e.preventDefault()
      moveTo(hit)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span id={labelId} className="text-sm font-medium text-slate-700">{label}</span>}
      <div ref={triggerRef}>
        <button
          type="button"
          id={baseId}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          // Focus never leaves the trigger while the panel is open, so this is
          // how a screen reader is told which option the cursor is on.
          aria-activedescendant={open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined}
          // combobox, not a bare button: this opens a list and holds a value,
          // and `aria-expanded` is what tells a screen-reader user whether the
          // list is currently open. `aria-labelledby` carries the field name
          // that <label htmlFor> cannot.
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          {...(label ? { 'aria-labelledby': labelId } : {})}
          {...(hint ? { 'aria-describedby': hintId } : {})}
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
            id={panelId}
            role="listbox"
            {...(label ? { 'aria-labelledby': labelId } : {})}
            // zIndex above the login modal's 9999 — a tie leaves paint order
            // to DOM position, which is how the city list vanished behind it.
            style={{ position: 'fixed', ...pos, zIndex: 10000 }}
            className="bg-white rounded-xl shadow-float border border-slate-200 overflow-y-auto"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value
              const isActive = i === activeIndex
              return (
                <button
                  key={opt.value}
                  id={`${baseId}-opt-${i}`}
                  ref={(el) => { optionRefs.current[i] = el }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  // Out of the tab order: the trigger holds focus and the arrow
                  // keys move the cursor. Leaving these tabbable meant Tab
                  // walked all 48 curfew options one at a time before reaching
                  // the next field.
                  tabIndex={-1}
                  onClick={() => handlePick(opt.value)}
                  // Pointer and keyboard share one cursor, so moving the mouse
                  // does not leave a highlight stranded somewhere else in the
                  // list — two highlights read as two selections.
                  onMouseMove={() => setActiveIndex(i)}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition-colors',
                    isSelected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 font-medium',
                    // The keyboard cursor is its own state, distinct from
                    // selected — you can be sitting on an option you have not
                    // chosen, and that is the entire point of it.
                    isActive && !isSelected ? 'bg-slate-100' : '',
                    isActive && isSelected ? 'bg-brand-100' : '',
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
      {hint   && <p id={hintId} className={`${BELOW_CONTROL} text-slate-500`}>{hint}</p>}
      {error  && <p className={`${BELOW_CONTROL} text-red-500`}>{error}</p>}
    </div>
  )
}
