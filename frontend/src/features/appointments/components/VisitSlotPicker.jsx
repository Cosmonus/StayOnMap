import { useRef, useEffect } from 'react'
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

export function DayStrip({ days, value, onChange, label = 'Pick a day' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {days.map((day) => (
        <DayCell key={day.value} day={day} selected={value === day.value} onSelect={onChange} />
      ))}
    </div>
  )
}

export function TimeGrid({ slots, value, onChange, label = 'Pick a time' }) {
  if (slots.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
        No times left on this day. Pick another day.
      </p>
    )
  }

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((t) => {
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
