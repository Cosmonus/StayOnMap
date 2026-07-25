// Short-stay only — lets a host block specific dates before publishing.
// Blocked dates are collected locally during the wizard and persisted via
// PUT /properties/:id/availability right after the property itself is
// created (see OnboardingWizard's submit sequence) — there's no property id
// to attach blocks to until that point.
import { useState } from 'react'

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export default function AvailabilityCalendar({ blockedDates, onChange }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )

  function keyFor(day) {
    return `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function toggle(day) {
    const key = keyFor(day)
    onChange(blockedDates.includes(key) ? blockedDates.filter((d) => d !== key) : [...blockedDates, key])
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="mt-6 max-w-xs">
      <p className="text-sm font-semibold text-slate-800 mb-3">Availability calendar</p>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button type="button" aria-label="Previous month" onClick={() => setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })} className="text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center"><span aria-hidden="true">‹</span></button>
          <p className="text-sm font-bold text-slate-900">{monthLabel}</p>
          <button type="button" aria-label="Next month" onClick={() => setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })} className="text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center"><span aria-hidden="true">›</span></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-slate-500 py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const blocked = blockedDates.includes(keyFor(day))
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(day)}
                className={`aspect-square rounded-lg text-xs font-mono flex items-center justify-center transition-colors ${
                  blocked ? 'bg-slate-100 text-slate-500 line-through' : 'text-slate-700 hover:bg-brand-50'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2.5">Tap a date to block it. Strikethrough = blocked for guests.</p>
    </div>
  )
}
