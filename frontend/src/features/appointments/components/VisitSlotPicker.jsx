import { useRef, useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatTime } from '@utils/time'

// The date and time of a visit, picked by looking at what is available rather
// than by opening two 30-item dropdowns and finding out on submit.
//
// The old form was `<Select>` of 30 dates beside `<TimeSelect>` of 23 slots.
// Both were closed lists: you could not see that Saturday was gone until you
// had chosen it, and you could not see the owner's window at all until after
// you had opened the time list. Worse, a date the owner had already committed
// to looked exactly like a free one — the request was accepted and then
// auto-rejected minutes later with "another visit was scheduled for this date".
//
// A DAY is the unit of availability, not a slot, because that is what the
// server believes: accepting one visit auto-rejects every other pending request
// for the same date. Greying individual times would tell the renter the owner
// runs several viewings a day, which is not what happens.

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function DayCell({ day, selected, onSelect }) {
  const ref = useRef(null)

  // Keep the chosen day on screen — the strip scrolls, and a date restored from
  // a draft or reset by a validation error can be well off to the right.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  const state = day.disabled
    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
    : selected
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={day.disabled}
      onClick={() => onSelect(day.value)}
      // The reason lives in the accessible name, not only in a tooltip: a
      // disabled control with no stated reason sends the blame to whatever is
      // interactive beside it.
      aria-label={`${day.full}${day.disabled ? ` — unavailable, ${day.reason}` : ''}`}
      title={day.disabled ? day.reason : undefined}
      className={`shrink-0 w-[62px] min-h-[72px] rounded-xl border flex flex-col items-center justify-center gap-0.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${state}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{day.weekday}</span>
      <span className="text-lg font-bold leading-none font-mono">{day.dayNum}</span>
      <span className="text-[11px] opacity-80">{day.month}</span>
      {day.disabled && (
        <span className="mt-0.5 w-6 h-px bg-slate-400" aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * Thirty days, side by side.
 *
 * The strip is `overflow-x-auto no-scrollbar`, which is right on a phone — you
 * swipe it — and left desktop with NOTHING. No scrollbar to drag (we hid it), no
 * arrows, and a mouse wheel scrolls the page rather than the strip, so a mouse
 * user could reach about the first week and had no way to know more existed.
 *
 * Arrows fix it, and they are `hidden sm:flex` deliberately: they are the
 * REPLACEMENT for a gesture a touch device already has, not an addition to it.
 * They appear only when there is somewhere to go, so the control does not
 * advertise days that are not there.
 *
 * The wheel is deliberately NOT hijacked. Converting vertical wheel to
 * horizontal scroll means the page stops scrolling whenever the pointer happens
 * to cross this strip, which is a worse bug than the one being fixed and is much
 * harder to attribute.
 */
export function DayStrip({ days, value, onChange, label = 'Pick a day' }) {
  const scroller = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    // A few px of slack: sub-pixel widths mean scrollLeft rarely reaches
    // scrollWidth - clientWidth exactly, and a right arrow that never disables
    // reads as broken.
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = scroller.current
    if (!el) return
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure, days.length])

  const page = (direction) => {
    const el = scroller.current
    if (!el) return
    // 80% of a viewport rather than 100%: a cell left partly visible on the far
    // side is what tells you the list continues.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const arrow = 'hidden sm:flex shrink-0 items-center justify-center w-9 h-[72px] rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-0 disabled:cursor-default transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

  return (
    <div className="flex items-center gap-2">
      {/* Outside the radiogroup: these move the view, they do not choose a day,
          and a screen reader walking the group should hear only days. */}
      <button
        type="button" onClick={() => page(-1)} disabled={!edges.left}
        aria-label="Show earlier days" className={arrow}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div
        ref={scroller}
        role="radiogroup"
        aria-label={label}
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 scroll-smooth"
      >
        {days.map((day) => (
          <DayCell key={day.value} day={day} selected={value === day.value} onSelect={onChange} />
        ))}
      </div>

      <button
        type="button" onClick={() => page(1)} disabled={!edges.right}
        aria-label="Show later days" className={arrow}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

// VISIT_SLOTS is 09:00–20:00 every half hour: 23 of them, and they used to
// render as one flat grid — eight rows of near-identical pills, which is a wall
// rather than a choice.
//
// Splitting by part of day is not decoration. "Morning or evening" is the
// decision somebody actually makes about a viewing; the exact half hour is the
// detail after it. At most ten pills are on screen at once, and the label above
// them says what they are.
const PERIODS = [
  { key: 'morning',   label: 'Morning',   from: 0,  to: 12 },
  { key: 'afternoon', label: 'Afternoon', from: 12, to: 17 },
  { key: 'evening',   label: 'Evening',   from: 17, to: 24 },
]

const hourOf = (t) => Number(String(t).split(':')[0])
const periodOf = (t) => (t ? PERIODS.find((p) => hourOf(t) >= p.from && hourOf(t) < p.to) : undefined)

// Below this, show every slot flat. Grouping is a cure for a wall of pills and
// nothing else — an owner whose window is 10am–12pm offers five times, and
// splitting five across two tabs hides three of them behind a click to solve a
// problem that does not exist. Eight is about three rows on a phone.
const FLAT_MAX = 8

export function TimeGrid({ slots, value, onChange, label = 'Pick a time' }) {
  // Null until the reader touches a period tab. The ACTIVE period is derived
  // below rather than stored, so a chosen time, a change of day and a manual tab
  // press cannot disagree about which group is open — the cascading-state bug
  // this codebase keeps meeting.
  const [picked, setPicked] = useState(null)

  if (slots.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
        No times left on this day. Pick another day.
      </p>
    )
  }

  const groups = slots.length > FLAT_MAX
    ? PERIODS
      .map((p) => ({ ...p, slots: slots.filter((t) => hourOf(t) >= p.from && hourOf(t) < p.to) }))
      .filter((p) => p.slots.length > 0)
    : [{ key: 'all', label: 'All', slots }]

  // Precedence: the tab you pressed, then the period holding the time you have
  // already chosen, then the earliest period with anything in it. Each falls
  // through only if the one before it is not available on THIS day — an owner's
  // window can leave a period empty, and a tab pressed yesterday must not open
  // an empty group today.
  const active =
    groups.find((g) => g.key === picked)
    ?? groups.find((g) => g.key === periodOf(value)?.key)
    ?? groups[0]

  return (
    <div className="space-y-2">
      {/* One group is not a choice — the tabs only appear when there is
          something to switch between. */}
      {groups.length > 1 && (
        <div role="tablist" aria-label="Time of day" className="flex gap-2">
          {groups.map((g) => {
            const on = g.key === active.key
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPicked(g.key)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g.label}
                <span className="ml-1.5 opacity-60 font-normal">{g.slots.length}</span>
              </button>
            )
          })}
        </div>
      )}

      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {active.slots.map((t) => {
          const selected = value === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t)}
              className={`min-h-[44px] rounded-xl border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {formatTime(t)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Shared by the form and its tests. `unavailableDates` is the ISO-date list
// from GET /properties/:id/appointments/availability.
export function buildDays({ count = 30, unavailable = [], hasSlots }) {
  const taken = new Set(unavailable)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const full = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

    // Two different reasons a day can't be picked, and they must not be
    // conflated: the owner is busy, or the day is simply over.
    const reason = taken.has(value)
      ? 'the owner already has a visit booked'
      : !hasSlots(value)
        ? 'no visiting hours left today'
        : null

    return {
      value,
      full: i === 0 ? `Today, ${full}` : i === 1 ? `Tomorrow, ${full}` : full,
      weekday: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : WEEKDAY[d.getDay()],
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      disabled: Boolean(reason),
      reason,
    }
  })
}
