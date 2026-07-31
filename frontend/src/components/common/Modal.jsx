import { useRef, useState } from 'react'

const SIZE_CLASS = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl',
  '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl',
  full: 'max-w-[95vw]',
}

// `footer` (sticky action bar) and `sheet` (bottom sheet on mobile, swipe
// down to close) opt into a structured layout; without them the original
// single-scroll panel renders unchanged for all existing callers.
export default function Modal({ isOpen, onClose, title, size = 'md', children, footer, sheet = false }) {
  const dragStartY = useRef(null)
  const [dragOffset, setDragOffset] = useState(0)

  if (!isOpen) return null

  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md

  if (!footer && !sheet) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
        <div className={`relative z-10 w-full ${sizeClass} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-panel border border-slate-200`}>
          {title && <ModalHeader title={title} onClose={onClose} />}
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
        style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
        className={`relative z-10 w-full ${sizeClass} flex flex-col overflow-hidden bg-white shadow-panel border border-slate-200 transition-transform
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
            <ModalHeader title={title} onClose={onClose} tight />
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

function ModalHeader({ title, onClose, tight = false }) {
  return (
    <div className={`flex items-center justify-between ${tight ? '' : 'mb-4'}`}>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <button
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
