// The questionnaire engine — pure functions over a schema and a draft.
//
// No Prisma, no WhatsApp, no HTTP. Given a category and what has been answered
// so far, it answers four questions: what is next, what is still required,
// how far along is this, and is THIS answer acceptable for THIS question. The
// WhatsApp engine (../engine.js) is one caller; a web or mobile form could be
// another, which is the reason this file knows nothing about buttons.
//
// The draft shape it reads:
//   draft.fields   { [field]: value }   every answered question
//   draft.location { lat, lng, confirmed: true, … }
//   draft.photos   [{ url, … }]
import { getQuestionnaire } from './schemas.js'

const SKIP_WORDS = new Set(['skip', 'no', 'none', 'nothing', 'na', 'n/a', 'nil', '-', 'later', 'not now', 'no thanks'])
const YES_WORDS  = new Set(['yes', 'y', 'yeah', 'yep', 'ya', 'sure', 'ok', 'okay', 'available', 'true', 'haan', 'aama'])
const NO_WORDS   = new Set(['no', 'n', 'nope', 'nah', 'not available', 'false', 'nahi', 'illa'])

/** Is a question currently visible, given what has been answered? */
export function isVisible(q, draft) {
  return typeof q.showIf === 'function' ? !!q.showIf(draft.fields ?? {}) : true
}

/** Has this question been answered (or explicitly skipped)? */
export function isAnswered(q, draft) {
  if (q.type === 'location') return !!draft.location?.confirmed
  if (q.type === 'image') return Array.isArray(draft.photos) && draft.photos.length >= (q.min ?? 1) && !!draft.photosDone
  const fields = draft.fields ?? {}
  if (!(q.field in fields)) return false
  // `null` is the explicit "skipped" marker for an optional question — it is
  // answered in the sense that we must not ask again.
  return true
}

/** The next unanswered visible question, or null when the draft is complete. */
export function nextQuestion(category, draft, { after = null } = {}) {
  const qs = getQuestionnaire(category)
  if (!qs) return null
  let seen = after == null
  for (const q of qs) {
    if (!seen) { if (q.id === after) seen = true; continue }
    if (!isVisible(q, draft)) continue
    if (!isAnswered(q, draft)) return q
  }
  // If `after` was given and nothing follows it, fall back to the first gap
  // anywhere — an edit may have cleared an earlier answer.
  if (after != null) return nextQuestion(category, draft)
  return null
}

export function findQuestion(category, id) {
  return getQuestionnaire(category)?.find((q) => q.id === id) ?? null
}

export function questionsInSection(category, section) {
  return (getQuestionnaire(category) ?? []).filter((q) => q.section === section)
}

/** Required questions still unanswered — what stands between the draft and a listing. */
export function missingRequired(category, draft) {
  return (getQuestionnaire(category) ?? []).filter((q) => q.required && isVisible(q, draft) && !isAnswered(q, draft))
}

/** 0–100 over the REQUIRED set. Optional questions never move it. */
export function completion(category, draft) {
  const required = (getQuestionnaire(category) ?? []).filter((q) => q.required && isVisible(q, draft))
  if (!required.length) return 0
  const done = required.filter((q) => isAnswered(q, draft)).length
  return Math.round((done / required.length) * 100)
}

// ── Parsing one answer for one question ─────────────────────────────────────

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * "28k", "28,000", "₹28000", "1.5 lakh", "2 cr" → integer rupees, or null.
 * Exported because the free-text extractor reuses it: one money parser, so a
 * lakh means the same thing in a button reply and in a paragraph.
 */
export function parseMoney(text) {
  if (text == null) return null
  const s = norm(text).replace(/₹|rs\.?|inr|rupees?/g, '').replace(/,/g, '').trim()
  const m = s.match(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lacs|lakh|lakhs|cr|crore|crores)?\b/)
  if (!m) return null
  let n = parseFloat(m[1])
  const unit = m[2] ?? ''
  if (unit === 'k' || unit === 'thousand') n *= 1_000
  else if (unit.startsWith('l')) n *= 100_000
  else if (unit.startsWith('cr')) n *= 10_000_000
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/**
 * "immediately", "1 sep", "September", "15/09/2026", "2026-09-01" → ISO
 * datetime string (what createPropertySchema's availableFrom expects), or null.
 * A bare month means the 1st of that month, rolled into next year if it has
 * already passed.
 */
export function parseDate(text, now = new Date()) {
  const s = norm(text)
  if (!s) return null
  if (/^(immediate|immediately|now|today|ready|available now|right away)$/.test(s)) return startOfDay(now).toISOString()
  if (/^(tomorrow)$/.test(s)) return startOfDay(new Date(now.getTime() + 86_400_000)).toISOString()
  if (/^next month$/.test(s)) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return validDate(+m[1], +m[2] - 1, +m[3])
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return validDate(+m[3], +m[2] - 1, +m[1])

  const monthIdx = (word) => MONTHS.findIndex((mo) => mo.startsWith(word.slice(0, 3)))
  m = s.match(/^(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (m && monthIdx(m[2]) >= 0) return rolled(now, monthIdx(m[2]), +m[1], m[3] ? +m[3] : null)
  m = s.match(/^(?:from\s+)?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/)
  if (m && monthIdx(m[1]) >= 0) return rolled(now, monthIdx(m[1]), +m[2], m[3] ? +m[3] : null)
  m = s.match(/^(?:from\s+)?([a-z]+)(?:\s+(\d{4}))?$/)
  if (m && monthIdx(m[1]) >= 0) return rolled(now, monthIdx(m[1]), 1, m[2] ? +m[2] : null)
  return null
}

function startOfDay(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
function validDate(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo, d))
  return dt.getUTCMonth() === mo && dt.getUTCDate() === d ? dt.toISOString() : null
}
function rolled(now, mo, d, y) {
  let year = y ?? now.getUTCFullYear()
  if (y == null && new Date(Date.UTC(year, mo, d)) < startOfDay(now)) year += 1
  return validDate(year, mo, d)
}

/**
 * Match free text against a select question's options: by option value, by
 * label, by a 1-based index ("2"), or by a leading word ("fully"). Returns the
 * option or null. Never guesses between two candidates.
 */
export function matchOption(q, text) {
  const s = norm(text)
  if (!s) return null
  const opts = q.options ?? []
  const byValue = opts.find((o) => norm(o.value) === s)
  if (byValue) return byValue
  const byLabel = opts.find((o) => norm(o.label) === s)
  if (byLabel) return byLabel
  if (/^\d{1,2}$/.test(s)) {
    const idx = parseInt(s, 10) - 1
    // A numeric reply on a numeric-valued option list ("2" for 2 BHK) means the
    // value, not the position.
    const numeric = opts.find((o) => typeof o.value === 'number' && o.value === parseInt(s, 10))
    if (numeric) return numeric
    if (opts[idx]) return opts[idx]
  }
  const partial = opts.filter((o) => norm(o.label).includes(s) || s.includes(norm(o.label)) || norm(o.value).includes(s))
  return partial.length === 1 ? partial[0] : null
}

/**
 * Multi-select: "1, 3, 5", "wifi, ac and parking", "none". Returns the matched
 * option values (deduped, in option order) — or [] for a "none"/"skip".
 */
export function matchOptions(q, text) {
  const s = norm(text)
  if (!s || SKIP_WORDS.has(s)) return []
  const parts = s.split(/\s*(?:,|;|\band\b|\+|\/|\n)\s*/).map((p) => p.trim()).filter(Boolean)
  const picked = new Set()
  for (const part of parts) {
    const o = matchOption(q, part)
    if (o) picked.add(o.value)
    else {
      // "wifi ac parking" with no separators — try each word.
      for (const word of part.split(' ')) {
        const w = matchOption(q, word)
        if (w && word.length >= 3) picked.add(w.value)
      }
    }
  }
  return (q.options ?? []).map((o) => o.value).filter((v) => picked.has(v))
}

/**
 * Validate and coerce one raw answer (string, number, boolean, or a location /
 * photo object) for one question.
 *
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
export function parseAnswer(q, raw) {
  const s = typeof raw === 'string' ? raw.trim() : raw

  // An optional question accepts a skip in every type.
  if (!q.required && typeof s === 'string' && SKIP_WORDS.has(norm(s))) return { ok: true, value: null }

  switch (q.type) {
    case 'text': {
      if (typeof s !== 'string' || !s) return { ok: false, error: 'Please type an answer.' }
      if (q.max && s.length > q.max) return { ok: false, error: `Please keep it under ${q.max} characters.` }
      return { ok: true, value: s }
    }
    case 'number': {
      const n = typeof s === 'number' ? s : parseFloat(String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? '')
      if (!Number.isFinite(n)) return { ok: false, error: 'Please reply with a number.' }
      if (q.min != null && n < q.min) return { ok: false, error: `That should be at least ${q.min}.` }
      if (q.max != null && n > q.max) return { ok: false, error: `That should be at most ${q.max}.` }
      return { ok: true, value: Number.isInteger(q.min ?? 0) && Number.isInteger(n) ? n : n }
    }
    case 'currency': {
      const n = typeof s === 'number' ? Math.round(s) : parseMoney(s)
      if (n == null) return { ok: false, error: 'Please reply with an amount, like 28000 or 28k or 1.5 lakh.' }
      if (q.min != null && n < q.min) return { ok: false, error: `That should be at least ₹${q.min}.` }
      if (q.max != null && n > q.max) return { ok: false, error: 'That amount looks too large — please check it.' }
      return { ok: true, value: n }
    }
    case 'single_select': {
      const o = typeof s === 'object' && s !== null && 'value' in s ? s : matchOption(q, s)
      if (!o) return { ok: false, error: 'Please pick one of the options.' }
      return { ok: true, value: o.value }
    }
    case 'multi_select': {
      if (Array.isArray(s)) return { ok: true, value: s.filter((v) => (q.options ?? []).some((o) => o.value === v)) }
      return { ok: true, value: matchOptions(q, s) }
    }
    case 'boolean': {
      if (typeof s === 'boolean') return { ok: true, value: s }
      const w = norm(s)
      if (YES_WORDS.has(w)) return { ok: true, value: true }
      if (NO_WORDS.has(w)) return { ok: true, value: false }
      return { ok: false, error: 'Please reply Yes or No.' }
    }
    case 'date': {
      const iso = parseDate(s)
      if (!iso) return { ok: false, error: 'Please give a date like "1 Sep", a month like "September", or say "immediately".' }
      return { ok: true, value: iso }
    }
    case 'phone': {
      const digits = String(s).replace(/\D/g, '')
      if (!/^(91)?[6-9]\d{9}$/.test(digits)) return { ok: false, error: 'Please share a 10-digit Indian mobile number.' }
      return { ok: true, value: digits.slice(-10) }
    }
    case 'confirmation': {
      const w = norm(s)
      if (YES_WORDS.has(w) || w === 'confirm') return { ok: true, value: true }
      if (NO_WORDS.has(w) || w === 'change') return { ok: true, value: false }
      return { ok: false, error: 'Please reply Confirm or Change.' }
    }
    case 'location':
    case 'image':
      // These are handled by their own sub-flows in the WhatsApp engine; a
      // typed answer here is "not a location" / "not a photo".
      return { ok: false, error: q.type === 'location' ? 'Please share the location as a WhatsApp location or a Google Maps link.' : 'Please send the photos as images.' }
    default:
      return { ok: false, error: 'Please try again.' }
  }
}

/** The prompt to show for a question, with any per-mode wording applied. */
export function questionLabel(q, draft) {
  const mode = draft.fields?.saleOrLease ?? draft.fields?.pricingModel
  return (mode && q.labelFor?.[mode]) || q.label
}
