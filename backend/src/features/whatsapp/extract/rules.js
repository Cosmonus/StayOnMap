// Deterministic extraction — the part that works with no API key.
//
// "2bhk in Velachery, fully furnished, 28k rent, 1 lakh deposit, available
// September" is a sentence with five facts in it, and most of them follow
// patterns an Indian owner uses every day: "28k", "1 lakh", "2bhk", "fully
// furnished", "in <place>". This module reads those. The LLM (ai.js) reads
// what this misses, and both are validated by the same questionnaire rules
// before anything is stored.
//
// Two rules that matter more than coverage:
//
//   1. MONEY IS ASSIGNED ONLY WITH A CUE. "28k" alone could be rent, deposit,
//      or an asking price. It becomes `rent` only next to "rent", "/month",
//      "pm" or "for"; `deposit` only next to "deposit"/"advance"; a lakh-scale
//      number becomes a sale price only when the category sells. An amount
//      with no cue is reported under `uncertain` so the engine asks.
//   2. A PLACE NAME IS NEVER A COORDINATE. "in Velachery" sets
//      `locationText`, which the location flow geocodes and asks the owner to
//      confirm — it never sets lat/lng.
//
// Every field carries a confidence; the merge layer (index.js) refuses to
// store a critical field below 0.9.
import { parseMoney, parseDate } from '../questionnaire/engine.js'

const TYPE_PATTERNS = [
  ['pg',        /\b(pg|paying guest|hostel|co-?living|coliving)\b/],
  ['stay',      /\b(short[- ]?stay|homestay|home stay|airbnb|guest ?house|service(d)? apartment|per night|nightly)\b/],
  ['shop',      /\b(shop|office|commercial|showroom|warehouse|godown|retail|restaurant space)\b/],
  ['land',      /\b(plot|land|site|acre|acres|cents?|ground|grounds)\b/],
  ['house',     /\b(house|villa|independent|duplex|bungalow|row ?house|kothi)\b/],
  // "2bhk" has no word boundary between the digit and the letters, so the
  // bedroom form is matched on its own.
  ['apartment', /\b(apartment|flat|apt|studio|1 ?rk)\b|\d\s*-?\s*bhk/],
]

const FURNISHED = [
  ['FULLY',       /\b(fully|full)[- ]?furnished\b/],
  ['SEMI',        /\bsemi[- ]?furnished\b/],
  ['UNFURNISHED', /\b(un[- ]?furnished|not furnished|bare shell|bare)\b/],
]

const FACING = /\b(east|west|north|south)[- ]?facing\b/
const APPROVAL = /\b(dtcp|rera|panchayat|unapproved)\b/
const GENDER_F = /\b(for )?(girls|ladies|women|female|womens|females)\b/
const GENDER_M = /\b(for )?(boys|gents|men|male|males|bachelors only)\b/
const SHARING = /\b(single|double|triple|(\d)\s*[- ]?sharing)\b/
const AREA = /(\d[\d,]*(?:\.\d+)?)\s*(sq\.? ?ft|sqft|sft|sq\.? ?feet|square feet|sq\.? ?yd|sq\.? ?yards?|cents?|acres?|grounds?)\b/g
const BHK = /\b(\d)\s*-?\s*(bhk|bed ?room|bedrooms|bed|bk)\b/
const STUDIO = /\b(studio|1 ?rk)\b/
const BATH = /\b(\d{1,2})\s*(bath|bathroom|bathrooms|toilets?)\b/
const FLOOR = /\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/
const GROUND_FLOOR = /\bground floor\b/
const GUESTS = /\b(\d{1,2})\s*(guests?|people|persons|pax)\b|\bsleeps\s*(\d{1,2})\b/
const PARKING = /\b(car )?parking\b/
const NO_PARKING = /\bno (car )?parking\b/
const AVAILABLE = /\b(?:available|vacant|possession)\s*(?:from|by|in|on)?\s*([a-z]+(?:\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/
const LOCATION_TEXT = /\b(?:in|at|near|@)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}(?:,\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})?)/
const MONEY_TOKEN = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|l|lac|lacs|lakh|lakhs|cr|crore|crores)?\b/gi

// Money cues, and how close they have to be. The word RIGHT AFTER an amount
// names it ("28k rent", "1 lakh deposit", "3500 per night", "9500 per bed");
// failing that, the nearest cue BEFORE it in the same clause does ("rent is
// 28k", "deposit of 1 lakh", "asking 45 lakhs", "for 28k"). A wide window in
// either direction is how "28k rent, 1 lakh deposit" once read both amounts
// as the deposit.
const CUES = [
  ['deposit', /\b(deposit|advance|security)\b/g],
  ['night',   /\b(night|nightly)\b/g],
  ['food',    /\b(food|mess|meals?)\b/g],
  ['maintenance', /\b(maintenance|maint)\b/g],
  ['price',   /\b(price|asking|selling|sale|expecting|expected|worth|quote|cost|budget)\b/g],
  ['rent',    /\b(rent|rental|rented|bed|for)\b/g],
  ['period',  /\b(month|monthly|mo|pm|p\.m\.|year|yearly|annum|pa)\b/g],
]
const CONJUNCTION = /^(and|&|with|plus|or|but|also)$/
const FOOD_CUES = /\b(food|mess|meals?)\b/

/** The cue named by the one or two words immediately after the amount. */
function cueAfter(after) {
  const m = after.match(/^[\s]*(?:\/|per\s+|a\s+|an\s+|as\s+|of\s+)?([a-z.]+)(?:\s+([a-z.]+))?/)
  if (!m) return null
  if (CONJUNCTION.test(m[1])) return null
  const words = `${m[1]} ${m[2] ?? ''}`
  // "per month" is a period; "per bed" / "per night" name the thing.
  for (const [name, re] of CUES) { re.lastIndex = 0; if (re.test(words)) return name }
  return null
}

/** The cue closest before the amount, within its clause. */
function cueBefore(before) {
  const clause = before.split(/[,;.\n]/).pop().slice(-40)
  let best = null
  for (const [name, re] of CUES) {
    re.lastIndex = 0
    let m; let lastIndex = -1
    while ((m = re.exec(clause))) lastIndex = m.index
    if (lastIndex >= 0 && (!best || lastIndex > best.index)) best = { name, index: lastIndex }
  }
  return best?.name ?? null
}

const set = (out, field, value, conf = 0.9) => { out.fields[field] = value; out.confidence[field] = conf }

/**
 * @param {string} text
 * @param {{ category?: string }} ctx
 * @returns {{ fields: object, confidence: object, uncertain: string[], propertyType: string|null }}
 */
export function extractByRules(text, { category = null } = {}) {
  const out = { fields: {}, confidence: {}, uncertain: [], propertyType: null }
  if (!text || typeof text !== 'string') return out
  const raw = text.trim()
  const s = raw.toLowerCase()

  // Property type — first pattern wins, in specificity order. A "2 BHK house"
  // is a house; "bhk" alone is a flat.
  for (const [key, re] of TYPE_PATTERNS) {
    if (re.test(s)) { out.propertyType = key; break }
  }
  const cat = category ?? out.propertyType

  // Bedrooms.
  const bhk = s.match(BHK)
  if (bhk) set(out, 'bhk', parseInt(bhk[1], 10))
  else if (STUDIO.test(s)) set(out, 'bhk', 0)

  for (const [value, re] of FURNISHED) { if (re.test(s)) { set(out, 'furnished', value); break } }

  const bath = s.match(BATH)
  if (bath) set(out, 'bathrooms', parseInt(bath[1], 10))

  if (GROUND_FLOOR.test(s)) set(out, 'floor', 0)
  else { const fl = s.match(FLOOR); if (fl) set(out, 'floor', parseInt(fl[1], 10), 0.8) }

  const guests = s.match(GUESTS)
  if (guests) set(out, 'maxGuests', parseInt(guests[1] ?? guests[3], 10))

  if (NO_PARKING.test(s)) set(out, 'parking', false)
  else if (PARKING.test(s)) set(out, 'parking', true, 0.8)

  const facing = s.match(FACING)
  if (facing) set(out, 'facingDirection', facing[1].toUpperCase())

  const approval = s.match(APPROVAL)
  if (approval) set(out, 'approvalStatus', { dtcp: 'DTCP', rera: 'RERA', panchayat: 'Panchayat', unapproved: 'Unapproved' }[approval[1]])

  if (GENDER_F.test(s)) set(out, 'genderPreference', 'FEMALE')
  else if (GENDER_M.test(s)) set(out, 'genderPreference', 'MALE')

  const sharing = s.match(SHARING)
  if (sharing) {
    const word = sharing[1]
    const n = word.startsWith('single') ? 1 : word.startsWith('double') ? 2 : word.startsWith('triple') ? 3 : parseInt(sharing[2], 10)
    if (n) set(out, 'sharing', Math.min(n, 4))
  }

  if (FOOD_CUES.test(s)) {
    if (/\b(with|including|incl\.?|included|inclusive of)\s+(food|mess|meals?)\b|\b(food|meals?)\s+(included|inclusive|provided)\b/.test(s)) set(out, 'foodIncluded', true)
    else if (/\b(without|no|excluding|not including)\s+(food|mess|meals?)\b|\b(food|meals?)\s+(not included|extra|separate)\b/.test(s)) set(out, 'foodIncluded', false)
  }

  // Area. "1200 sqft" is the built-up area on a home, the extent on a plot.
  for (const m of s.matchAll(AREA)) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    const unit = m[2].replace(/\./g, '').replace(/\s+/g, '')
    if (!Number.isFinite(n)) continue
    if (cat === 'land' || /cent|acre|ground|yd|yard/.test(unit)) {
      set(out, 'extent', n)
      set(out, 'extentUnit', /cent/.test(unit) ? 'cents' : /acre/.test(unit) ? 'acres' : /ground/.test(unit) ? 'ground' : /yd|yard/.test(unit) ? 'sq.yd' : 'sq.ft')
    } else if (cat === 'shop') set(out, 'carpetArea', n)
    else set(out, 'area', n)
    break
  }

  // Availability.
  const avail = s.match(AVAILABLE)
  if (avail) {
    const iso = parseDate(avail[1])
    if (iso) set(out, 'availableFrom', iso, 0.85)
  } else if (/\b(immediate|immediately|ready to move|available now)\b/.test(s)) {
    set(out, 'availableFrom', parseDate('immediately'), 0.85)
  }

  // Money — with cues only.
  extractMoney(s, cat, out)

  // A place name, from the ORIGINAL casing: "in Velachery" — proper nouns
  // capitalise, and the lowercase copy has lost that signal.
  const loc = raw.match(LOCATION_TEXT)
  if (loc) {
    const name = loc[1].replace(/[.,]+$/, '').trim()
    if (name.length >= 3 && !/^(september|october|november|december|january|february|march|april|may|june|july|august)\b/i.test(name)) {
      set(out, 'locationText', name, 0.8)
    }
  }

  return out
}

function extractMoney(s, cat, out) {
  const tokens = []
  for (const m of s.matchAll(MONEY_TOKEN)) {
    const digits = m[1].replace(/,/g, '')
    const amount = parseMoney(m[0])
    if (amount == null || amount === 0) continue
    // Skip tokens that are really part of another fact: "2bhk", "3 bath",
    // "1200 sqft", "4th floor", a pincode, a year.
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 12)
    const before = s.slice(Math.max(0, m.index - 12), m.index)
    if (/^\s*(bhk|bed\b|bath|sq|sft|floor|st\b|nd\b|rd\b|th\b|guest|people|pax|sharing|feet|ft\b|cents?|acres?|grounds?|kms?|km\b|min\b)/.test(after)) continue
    if (/^\d{6}$/.test(digits)) continue
    // "built 2019" is a year; "2000 per month" is money. Only the wording
    // before it can tell them apart, so a four-digit 19xx/20xx is a year
    // only when it is introduced as one.
    if (/^(19|20)\d{2}$/.test(digits) && /\b(built|since|constructed|year|yr|in|from|of|est\.?)\s*$/.test(before)) continue
    if (/\b(pin|pincode|floor|sleeps|upto|up to|max|maximum)\s*$/.test(before)) continue
    tokens.push({ amount, start: m.index, end: m.index + m[0].length, unit: m[2] ?? '' })
  }
  if (!tokens.length) return

  const isRentalCat = cat == null || ['apartment', 'house', 'pg', 'shop'].includes(cat)
  for (const t of tokens) {
    const afterCue = cueAfter(s.slice(t.end, t.end + 24))
    const beforeCue = cueBefore(s.slice(Math.max(0, t.start - 40), t.start))
    // A bare period after the amount ("2000 per month") defers to a named cue
    // before it ("food charges 2000 per month"); otherwise the after-cue wins.
    let cue = afterCue
    if ((cue == null || cue === 'period') && beforeCue && beforeCue !== 'period') cue = beforeCue
    if (cue == null && beforeCue === 'period') cue = 'period'
    // Lakh- and crore-scale amounts on land are prices whatever the wording.
    if (cue == null && cat === 'land' && /^(l|lac|lacs|lakh|lakhs|cr|crore|crores)$/.test(t.unit)) cue = 'price'

    const uncertain = () => out.uncertain.push(`₹${t.amount.toLocaleString('en-IN')}`)
    switch (cue) {
      case 'deposit': set(out, 'deposit', t.amount); break
      case 'maintenance': set(out, 'maintenance', t.amount, 0.85); break
      case 'night':   cat === 'stay' || cat == null ? set(out, 'nightlyRate', t.amount) : uncertain(); break
      case 'food':    cat === 'pg' ? set(out, 'foodCharges', t.amount, 0.8) : uncertain(); break
      case 'price':   set(out, 'rent', t.amount); break
      case 'rent':
      case 'period':
        if (cat === 'stay') { uncertain(); break }
        if (isRentalCat || cat === 'land') { if (out.fields.rent === undefined) set(out, 'rent', t.amount); else uncertain() }
        else uncertain()
        break
      default: uncertain()
    }
  }
}
