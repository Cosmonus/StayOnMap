// One overflow menu for the whole app: a trigger plus a list of items, some of
// which navigate and some of which act. Extracted from Header.jsx (which had
// the only copy) when the listing rows needed the same thing — Hick's law says
// five equal-weight buttons on a row is five decisions, and the two that matter
// are not the five.
//
// The PANEL is portalled and fixed-positioned, not `absolute` beside the
// trigger. Two bugs made that mandatory, and both looked like "the ⋯ button
// does nothing":
//   1. The dismiss backdrop is portalled to <body>, so it lands after the page
//      in DOM order. An absolute panel at the same z-index therefore painted
//      UNDER it, and every click hit the backdrop: the menu closed and the item
//      never ran. Header survived only because it is `fixed z-50` and so makes
//      its own stacking context — every other caller (listing rows, the host
//      visit queue) was dead from the day this was extracted.
//   2. An absolute panel is clipped by any scrolling ancestor, which is exactly
//      where these rows live (`overflow-y-auto` page bodies), so the last row's
//      menu was cut off even when it did open.
// Same portal + fixed pattern as Select.jsx and CityDropdown.jsx.
//
// Items: { key, label, icon?, to? | onClick?, badge?, danger?, divider?, className? }
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'

const GAP = 8
const EDGE = 8

function Badge({ count }) {
  if (!count) return null
  return (
    <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[11px] font-bold rounded-full bg-red-500 text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function ActionMenu({
  // Defaulted, because the failure mode of forgetting it is INVISIBLE: the
  // button still renders, still works, and paints as an empty bordered box with
  // nothing in it. That shipped in the admin panel's Review Listings detail —
  // `RecheckMenu` passed items and a triggerClassName and no trigger, so the
  // "Re-run checks" control was a blank rectangle nobody could recognise as a
  // control. A default glyph cannot be as good as a chosen one, and it is
  // enormously better than nothing.
  trigger = <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />,
  items,
  label = 'Open menu',
  triggerClassName,
  align = 'right',
  width = 'w-56',
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)

  // Anchored to the trigger's viewport rect. Right-align uses `right` rather
  // than `left` so the panel's own width never has to be measured, and the menu
  // flips above the trigger when there isn't room below — the bottom row of a
  // long list is where an overflow menu is most often opened.
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const flip = below < 220 && r.top > below
    setPos({
      top: flip ? undefined : r.bottom + GAP,
      bottom: flip ? window.innerHeight - r.top + GAP : undefined,
      right: align === 'right' ? Math.max(EDGE, window.innerWidth - r.right) : undefined,
      left: align === 'right' ? undefined : Math.max(EDGE, r.left),
      maxHeight: Math.max(120, (flip ? r.top : below) - GAP - EDGE),
    })
  }, [align])

  useEffect(() => {
    if (!open) return
    place()
    // A fixed panel can't follow the page, so anything that moves the trigger
    // closes the menu instead of leaving it stranded mid-air. Capture phase:
    // the scroll may be on any ancestor, not the window.
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function close() { setOpen(false) }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName ?? 'flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-100 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'}
      >
        {trigger}
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            role="menu"
            style={{ position: 'fixed', ...pos, zIndex: 9999 }}
            className={`${width} overflow-y-auto bg-white rounded-xl shadow-panel border border-slate-200 py-2`}
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
                  className={`flex items-center justify-between gap-2 px-4 py-3 text-sm no-underline ${
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
                  className={`w-full min-h-[44px] flex items-center justify-between gap-2 text-left px-4 py-3 text-sm ${
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
        </>,
        document.body,
      )}
    </>
  )
}
