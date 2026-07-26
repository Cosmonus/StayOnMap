// One time vocabulary for the whole app.
//
// Times are STORED and SENT as 24-hour `HH:MM` — that's what the backend
// validates (`appointmentWindowStart` et al) and what string-compares
// correctly for window bounds. Times are always SHOWN 12-hour, everywhere,
// because a curfew rendered "22:30" beside a visit slot rendered "10:30 PM"
// reads as two different products.
//
// Half-hourly is the only granularity offered. A native <input type="time">
// lets an owner pick 22:37 and renders OS chrome that matches nothing else on
// the page; a free-text box (what the curfew field used to be) accepts
// "morning", which is not a time at all.

const pad = (n) => String(n).padStart(2, '0')

function slotsBetween(startHour, endHour) {
  const out = []
  for (let m = startHour * 60; m <= endHour * 60; m += 30) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  }
  return out
}

// Any time of day — curfews, and anything else that isn't a visit slot.
export const ALL_DAY_SLOTS = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`
)

// The hours a stranger can reasonably knock on a door. Property visit requests
// and the owner's own visit window both come from here.
export const VISIT_SLOTS = slotsBetween(9, 20)

// '14:30' → '2:30 PM'. Anything that isn't HH:MM comes back untouched — older
// rows and hand-typed curfews ("morning") predate the picker and must not be
// mangled into a wrong time.
export function formatTime(value) {
  if (!value) return ''
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim())
  if (!m) return String(value)
  const h = Number(m[1])
  if (h > 23 || Number(m[2]) > 59) return String(value)
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

// Slot list → <Select> options.
export function timeOptions(slots) {
  return slots.map((t) => ({ value: t, label: formatTime(t) }))
}
