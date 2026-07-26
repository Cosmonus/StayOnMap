// One overflow menu for the whole app: a trigger plus a list of items, some of
// which navigate and some of which act. Extracted from Header.jsx (which had
// the only copy) when the listing rows needed the same thing — Hick's law says
// five equal-weight buttons on a row is five decisions, and the two that matter
// are not the five.
//
// Items: { key, label, icon?, to? | onClick?, badge?, danger?, divider?, className? }
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

function Badge({ count }) {
  if (!count) return null
  return (
    <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[11px] font-bold rounded-full bg-red-500 text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function ActionMenu({
  trigger,
  items,
  label = 'Open menu',
  triggerClassName,
  align = 'right',
  width = 'w-56',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Escape closes, because a menu you can only dismiss with the mouse is a trap
  // for anyone driving this from the keyboard.
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName ?? 'flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-100 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'}
      >
        {trigger}
      </button>

      {open && (
        <>
          {/* Portal the backdrop to <body>: an ancestor with a CSS transform
              (the header's hide-on-scroll animation) becomes the containing
              block for fixed descendants, so a nested `fixed inset-0` is
              trapped inside that ancestor and never covers the page. */}
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
            document.body,
          )}
          <div
            role="menu"
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 z-40 ${width} bg-white rounded-xl shadow-panel border border-slate-200 py-2`}
          >
            {items.map((item) =>
              item.divider ? (
                <div key={item.key} className={`border-t border-slate-200 my-1 ${item.className ?? ''}`} />
              ) : item.to ? (
                <Link
                  key={item.key}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm no-underline ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
                  } ${item.className ?? ''}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.icon && <span className="shrink-0 text-slate-500">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <Badge count={item.badge} />
                </Link>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); item.onClick() }}
                  className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2.5 text-sm ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
                  } ${item.className ?? ''}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.icon && <span className={`shrink-0 ${item.danger ? 'text-red-500' : 'text-slate-500'}`}>{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <Badge count={item.badge} />
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
