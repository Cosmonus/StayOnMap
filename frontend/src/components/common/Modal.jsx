import { useRef, useState, useEffect, useId } from 'react'
import { X } from 'lucide-react'

const SIZE_CLASS = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl',
  '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl',
  full: 'max-w-[95vw]',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// The app's ONE overlay primitive, in both shapes: a centred dialog, and — with
// `sheet` — a bottom sheet on mobile that swipes down to close. There was a
// second, unused `components/layout/BottomSheet.jsx` offering a worse version of
// the sheet half (no dismissal, no semantics, snap dots as unlabelled buttons);
// it was deleted rather than promoted, because two overlays is how they drift.
//
// Dialog behaviour lives here so no caller has to remember it. Until 2026-08-07
// none of it existed: every modal in the app rendered as a plain <div>, so a
// screen reader never announced one opening, Escape did nothing, Tab walked
// straight out into the page behind, focus never came back to whatever opened
// it, and the background scrolled under the backdrop.
export default function Modal({ isOpen, onClose, title, size = 'md', children, footer, sheet = false }) {
  const dragStartY = useRef(null)
  const [dragOffset, setDragOffset] = useState(0)
  const panelRef = useRef(null)
  const titleId = useId()

  // Escape to close, Tab trapped inside, focus moved in on open and restored to
  // the opener on close. One effect because they share a lifetime.
  useEffect(() => {
    if (!isOpen) return
    const opener = document.activeElement

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // Scroll lock. Read the previous value rather than assuming '' — nested
    // overlays would otherwise unlock the page when the inner one closes.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first control, or the panel itself when there is none, so the
    // reading position starts inside the dialog either way.
    const panel = panelRef.current
    const target = panel?.querySelector(FOCUSABLE) ?? panel
    target?.focus?.({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus?.({ preventScroll: true })
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md
  const dialogProps = {
    ref: panelRef,
    role: 'dialog',
    'aria-modal': true,
    tabIndex: -1,
    ...(title ? { 'aria-labelledby': titleId } : { 'aria-label': 'Dialog' }),
  }

  if (!footer && !sheet) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
        <div
          {...dialogProps}
          className={`relative z-10 w-full ${sizeClass} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-panel border border-slate-200 focus:outline-none`}
        >
          {title && <ModalHeader title={title} titleId={titleId} onClose={onClose} />}
          {children}
        </div>
      </div>
    )
  }

  function onTouchStart(e) { dragStartY.current = e.touches[0].clientY }
  function onTouchMove(e) {
    if (dragStartY.current === null) return
    setDragOffset(Math.max(0, e.touches[0].clientY - dragStartY.current))
  }
  function onTouchEnd() {
    if (dragOffset > 80) onClose()
    dragStartY.current = null
    setDragOffset(0)
  }

  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${sheet ? 'items-end md:items-center md:p-4' : 'items-center p-4'}`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        {...dialogProps}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
        className={`relative z-10 w-full ${sizeClass} flex flex-col overflow-hidden bg-white shadow-panel border border-slate-200 transition-transform focus:outline-none
          ${sheet ? 'max-h-[92vh] md:max-h-[86vh] rounded-t-3xl md:rounded-2xl' : 'max-h-[90vh] rounded-2xl'}`}
      >
        {sheet && (
          <div
            className="md:hidden shrink-0 flex justify-center pt-3 pb-1 cursor-grab touch-none"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          >
            <span className="w-10 h-1.5 rounded-full bg-slate-200" />
          </div>
        )}
        {title && (
          <div className="shrink-0 px-6 pt-4 pb-3 border-b border-slate-100">
            <ModalHeader title={title} titleId={titleId} onClose={onClose} tight />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* As a bottom sheet the footer sits on the screen edge, so its buttons
            end up under the home indicator / gesture bar with nothing below
            them. Pad past the safe-area inset on mobile; the centered desktop
            dialog has an edge of its own and keeps the tighter padding. */}
        {footer && (
          <div
            className={`shrink-0 border-t border-slate-200 bg-white px-6 py-3 ${
              sheet ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-3' : ''
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalHeader({ title, titleId, onClose, tight = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${tight ? '' : 'mb-4'}`}>
      <h2 id={titleId} className="text-lg font-semibold text-slate-800">{title}</h2>
      {/* 44px target around a 20px glyph — the button is sized, not the icon.
          It used to be a bare "✕" in a 28px box with no accessible name, so
          TalkBack and VoiceOver read it as an unlabelled button. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
      >
        <X className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
