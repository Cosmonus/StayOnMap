// A deliberately conservative reader for OSM `opening_hours`.
//
// The real grammar is large — public holidays, month and week ranges, sunset
// offsets, "Mo-Fr 09:00-12:00,13:00-18:00; Sa off; PH off", open-ended rules.
// Implementing a fraction of it and treating the rest as "closed" would put a
// wrong claim on a place's card, which is worse than saying nothing.
//
// So this answers only when it is sure, and returns null for everything else.
// null means "we don't know", and the UI must render it as unknown — never as
// closed. OSM hours coverage in India is thin enough that unknown is the
// common case by a wide margin, which is exactly why hours are shown as
// information and never used to rank or hide a place.
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// A rule we can read: one or more day tokens/ranges, then one time range.
// Anything with commas in the times, holidays, months, weeks, or offsets is
// out of scope on purpose.
const RULE = /^(?<days>[A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+(?<from>\d{1,2}:\d{2})-(?<to>\d{1,2}:\d{2})$/

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Expand "Mo-Fr" / "Mo,We" into day indices, or null if unreadable. */
function daysOf(spec) {
  const out = new Set()
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-')
    const from = DAYS.indexOf(a)
    if (from === -1) return null
    if (b === undefined) { out.add(from); continue }
    const to = DAYS.indexOf(b)
    if (to === -1) return null
    // Ranges wrap (e.g. Sa-Su), so walk forward rather than assuming from < to.
    for (let i = from; ; i = (i + 1) % 7) {
      out.add(i)
      if (i === to) break
    }
  }
  return out
}

/**
 * Is this place open at `at`?
 *
 * @param {string|null} spec  the raw OSM opening_hours value
 * @param {Date} at
 * @returns {boolean|null} true/false when confidently known, null otherwise
 */
export function isOpenAt(spec, at = new Date()) {
  if (typeof spec !== 'string') return null
  const value = spec.trim()
  if (!value) return null

  if (value === '24/7') return true

  // Parse EVERY rule before evaluating any. A spec is only answerable if all
  // of it is understood: "Mo-Fr 09:00-18:00; PH off" reads as open at Tuesday
  // noon if you stop at the first matching rule, and the holiday exception
  // that would have closed it is never examined. Answering from the rules we
  // happened to understand is how a confident wrong claim gets onto a card.
  const parsed = []
  for (const raw of value.split(';')) {
    const rule = raw.trim()
    if (!rule) continue

    const m = RULE.exec(rule)
    if (!m) return null

    const days = daysOf(m.groups.days)
    if (!days) return null

    parsed.push({ days, from: minutes(m.groups.from), to: minutes(m.groups.to) })
  }

  if (!parsed.length) return null

  const day = at.getDay()
  const now = at.getHours() * 60 + at.getMinutes()

  for (const { days, from, to } of parsed) {
    if (!days.has(day)) continue
    // An overnight range (22:00-02:00) belongs to two calendar days; treat it
    // as open from `from` to midnight and midnight to `to`.
    const open = to <= from ? (now >= from || now < to) : (now >= from && now < to)
    if (open) return true
  }

  // Every rule was readable and none covers now — genuinely closed.
  return false
}

/** 'open' | 'closed' | null — the shape the API hands to clients. */
export function openState(spec, at = new Date()) {
  const open = isOpenAt(spec, at)
  return open === null ? null : (open ? 'open' : 'closed')
}
