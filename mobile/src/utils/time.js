// Mirrors frontend/src/utils/time.js — one time vocabulary across both
// platforms. Keep the two in sync; a curfew that reads "22:30" on Android and
// "10:30 PM" on web is the same listing describing itself two ways.
//
// Times are STORED and SENT as 24-hour `HH:MM` (what the backend validates and
// what string-compares correctly for window bounds), and always SHOWN 12-hour.
//
// React Native has no native time input at all, which is why every time field
// here is a slot list rather than a text box: "10", "10 am" and "morning" all
// typed fine in the boxes these replaced, and none of them is a time.

const pad = (n) => String(n).padStart(2, '0')

// Any time of day — curfews, and anything else that isn't a visit slot.
export const ALL_DAY_SLOTS = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`
)

// The hours a stranger can reasonably knock on a door. Visit requests, the
// owner's suggested slot, and the listing's own visit window all come from here.
export const VISIT_SLOTS = Array.from(
  { length: 23 },
  (_, i) => `${pad(9 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`
)

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

// Slot list → Dropdown options.
export function timeOptions(slots) {
  return slots.map((t) => ({ value: t, label: formatTime(t) }))
}
