// Every sentence the bot says, in one file.
//
// Kept apart from the engine so the tone can be edited without touching the
// state machine, and so a test can assert on behaviour without matching prose.
// Per-type wording lives here too: a plot is never told "your home".
import { CATEGORIES, SECTIONS } from './questionnaire/schemas.js'
import { toDisplay } from './phone.js'

export const BRAND = 'StayOnMap'

// The Android app — the one place this URL is written on the backend.
// (The web frontend keeps its own copy in frontend/src/lib/seo.js.)
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.stayonmap.app'

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`

export const FURNISHED_WORD = { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

// ── Identity & greetings ──────────────────────────────────────────────────

export const welcome = (name) =>
  `Hi${name ? ` ${name}` : ''} 👋 Welcome to ${BRAND} — India's broker-free rental map.\n\n` +
  `List your property right here on WhatsApp. I'll ask a few questions, you share the location and photos, and it goes live after a quick check.\n\n` +
  `You can answer in your own words at any point — e.g. "2 BHK in Velachery, 28k rent, 1 lakh deposit".`

// ── The broker gate — asked before anything else ──────────────────────────
// Broker-free is the whole product, so the flow's first question is the
// honest one. The threat is real: listings are verified, and the ban is on
// the NUMBER, which on this platform is the identity.

export const brokerGate = () =>
  `Before we start, one honest question. 🛡\n\n` +
  `${BRAND} is India's *broker-free* rental map. Renters come here because every home is listed by its real owner — no commission, no middlemen. That promise is the whole platform, and we enforce it strictly.\n\n` +
  `*Are you a broker?*\n\n` +
  `⚠️ Every listing is verified before it goes live. Broker listings are removed the moment we find them, and the property and this number are *permanently banned*.`

export const brokerRejected = () =>
  `Thanks for being straight with us — but ${BRAND} is strictly owner-listed, and we don't accept broker listings at any price.\n\n` +
  `If you personally own a property, you're welcome any time — just say *hi* to list it. 🏠`

export const askType = () => 'What would you like to list?'

export const typeRows = () => Object.entries(CATEGORIES).map(([key, c]) => ({
  id: `type:${key}`, title: `${c.emoji} ${c.label}`,
}))

export const didNotUnderstandType = () =>
  `Sorry, I didn't catch that. Please choose what you're listing:\n\n` +
  Object.values(CATEGORIES).map((c) => `${c.emoji} ${c.label}`).join('\n')

export const businessGate = (category) =>
  `${CATEGORIES[category].label} listings are business listings on ${BRAND} (you run this as a business, and renters see a business badge).\n\nContinue as a business host?`

export const linkOffer = (maskedEmail) =>
  `We found a ${BRAND} account with this number — ${maskedEmail}. Is that you?\n\nIf yes, your listing will be added to that account.`

export const linkedAccount = () => `Done — this number is now verified on your ${BRAND} account. ✅`

export const startedFresh = () => `No problem — I've set up a fresh ${BRAND} account for this number.`

// ── Questionnaire ────────────────────────────────────────────────────────

export const typeChosen = (category) => {
  const c = CATEGORIES[category]
  return `${c.emoji} ${c.label} — great.`
}

export const capturedSummary = (category, fields) => {
  const parts = describeFields(category, fields)
  if (!parts.length) return null
  return `Got it 👍 ${parts.join(' · ')}`
}

export const stillNeed = (questions) =>
  `I have most of the details. I just need:\n\n` + questions.map((q) => `${emojiFor(q)} ${shortLabel(q)}`).join('\n')

export const clarify = (uncertain) =>
  `I saw ${uncertain.join(' and ')} but I'm not sure what it's for — I'll ask about each amount so nothing is guessed.`

export const invalidAnswer = (error) => `${error}`

export const didNotUnderstand = () =>
  `Sorry, I didn't understand that. You can answer the question above, or send *help* for what I can do.`

export const help = () =>
  `Here's what you can do:\n\n` +
  `• Answer the current question, or describe the property in your own words\n` +
  `• Share the location with 📎 → Location, or paste a Google Maps link\n` +
  `• Send photos any time\n` +
  `• *status* — see what's done\n` +
  `• *restart* — start over\n` +
  `• *cancel* — stop listing`

export const status = (category, pct, missing) =>
  `${CATEGORIES[category]?.emoji ?? '🏠'} Your ${CATEGORIES[category]?.label ?? 'listing'} is ${pct}% done.` +
  (missing.length ? `\n\nStill needed:\n${missing.map((q) => `• ${shortLabel(q)}`).join('\n')}` : '\n\nEverything is in — say *review* to see it.')

export const cancelled = () => `Okay, I've cancelled this listing. Say *hi* any time to start again.`
export const restarted = () => `Starting over. 🔄`

export const resumed = (category, pct) =>
  `Welcome back 👋 Your ${CATEGORIES[category]?.label ?? 'listing'} is ${pct}% done — let's continue.`

export const confirmRestart = () => `You have a listing in progress. Start over and lose what's entered?`

// ── Location ─────────────────────────────────────────────────────────────

export const askLocation = (category) =>
  `📍 Please share the exact location of the ${nounFor(category)}.\n\n` +
  `Tap 📎 (or +) → *Location* → send the ${nounFor(category)}'s location — or paste a Google Maps link.\n\n` +
  `Please don't send your current location unless you're standing at the ${nounFor(category)}.`

export const locationCandidate = (c) => {
  const where = [c.locality, c.city].filter(Boolean).join(', ') || c.address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
  const addr = c.address && c.address !== where ? `\n${c.address}` : ''
  return `📍 ${where}${addr}\n\nIs this the exact ${c.precision === 'approximate' ? 'property' : 'property'} location?`
}

export const locationImprecise = (place) =>
  `I found ${place ? `*${place}*` : 'that area'}, but that's an area, not a building — the map needs the exact spot.\n\n` +
  `Please share the exact property location using 📎 → *Location*, or send a Google Maps pin.`

export const locationUnresolved = () =>
  `I couldn't find that place. Please share the location with 📎 → *Location*, or paste a Google Maps link to the property.`

export const locationOutsideIndia = () => `That location is outside India. Please share the property's location in India.`

export const locationUnsupported = (place) =>
  `${BRAND} isn't open ${place ? `in ${place}` : 'in that city'} yet — we cover 47 cities across Tamil Nadu, Karnataka, Telangana, Maharashtra, Delhi, Gujarat and West Bengal.\n\n` +
  `If the property is somewhere else, share its location again; otherwise say *cancel* and we'll let you know when we open there.`

export const locationConfirmed = (c) => `📍 Location confirmed — ${[c.locality, c.city].filter(Boolean).join(', ')}.`

export const locationChange = () => `Sure — share the location again with 📎 → *Location*, or paste a Google Maps link.`

export const askPincode = () => `What is the property's 6-digit pincode?`

// ── Email (asked at the START, before the property questions) ────────────
// Required since 2026-09-02 (operator decision): every WhatsApp owner enters
// an email up front. Until then it was one optional ask at review.

export const askEmail = () =>
  `First, what's your *email address*?\n\n` +
  `We'll send updates about your listing there, and it lets you sign in on the website.`
export const emailSaved = (email) => `✉️ Saved ${email} to your account.`
export const emailInvalid = () => `That doesn't look like an email address — please type it again (like name@example.com).`
// "In use", never whose: User.email is unique and naming the account would be
// an enumeration oracle. Skip is offered ONLY here, because the address they
// hold may be on their own web account and there is no way through otherwise.
export const emailTaken = () =>
  `That email is already in use on another ${BRAND} account. Please enter a different email — or reply *skip* to continue without one for now.`

// ── Photos ───────────────────────────────────────────────────────────────

export const askPhotos = (category) =>
  `📸 Please send photos of the ${nounFor(category)}.\n\nYou can send several together. ${photoHint(category)}\n\nTap *Done* when you've sent them all.`

export const photoReceived = (count) => `📸 Received ${count} photo${count === 1 ? '' : 's'}.`
export const photoDuplicate = () => `That photo is already added.`
export const photoInvalid = () => `That file isn't a photo I can use — please send JPEG or PNG images.`
export const photoFailed = () => `I couldn't save that photo. Please try sending it again.`
export const photosFull = (max) => `That's the maximum of ${max} photos — tap *Done* to continue.`
export const needPhotos = () => `I need at least one photo before the listing can go up. Please send a photo of the property.`

// ── Review ───────────────────────────────────────────────────────────────

export function reviewSummary(category, draft, { showExactLocation }) {
  const f = draft.fields ?? {}
  const loc = draft.location ?? {}
  const c = CATEGORIES[category]
  const lines = [`Here's your ${BRAND} listing:`, '']
  lines.push(`${c.emoji} ${headline(category, f)}`)
  lines.push(`📍 ${[loc.locality, loc.city].filter(Boolean).join(', ')}`)
  lines.push(...priceLines(category, f))
  const extra = describeFields(category, f, { skip: ['rent', 'deposit', 'nightlyRate', 'bhk', 'houseStyle', 'sharing', 'placeType', 'commercialType', 'extent', 'extentUnit', 'landType', 'pricingModel', 'maintenance', 'cleaningFee', 'weekendRate', 'priceNegotiable', 'visitContact', 'appointmentWindowStart', 'appointmentWindowEnd'] })
  if (extra.length) lines.push(...extra.map((e) => `• ${e}`))
  lines.push(`📸 ${(draft.photos ?? []).length} photos`)
  lines.push(...visitLines(f))
  lines.push('')
  lines.push(`📍 Location confirmed. Map shows: *${showExactLocation ? 'exact pin' : 'approximate area (~150 m)'}* — reply *approximate* or *exact* to change.`)
  lines.push('')
  lines.push('Ready to publish?')
  return lines.join('\n')
}

// How a renter arranges a visit — shown on the review and in the live message.
export function visitLines(f) {
  const lines = []
  if (f.appointmentWindowStart && f.appointmentWindowEnd) lines.push(`🕒 Visits ${fmtTime(f.appointmentWindowStart)} – ${fmtTime(f.appointmentWindowEnd)}`)
  if (f.visitContact) lines.push(`📞 Renters reach you by ${VISIT_CONTACT_WORDS[f.visitContact] ?? f.visitContact}`)
  return lines
}

const VISIT_CONTACT_WORDS = { CALL: 'phone call', WHATSAPP: 'WhatsApp', CHAT: 'message in the app' }

/** "10:00" → "10 AM", "17:30" → "5:30 PM". */
export function fmtTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h)) return String(hhmm)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour12}:${String(m).padStart(2, '0')} ${suffix}` : `${hour12} ${suffix}`
}

export const editSections = () => Object.entries(SECTIONS).map(([id, title]) => ({ id: `edit:${id}`, title }))
export const askWhatToEdit = () => `What would you like to change?`
export const editingSection = (id) => `Okay — let's redo *${SECTIONS[id] ?? id}*.`
export const askWhatToChange = (sectionTitle) =>
  `What in *${sectionTitle}* would you like to change?\n\nEverything else keeps its answer — you'll be back at the review right after.`

/** "₹28,000/month" / "Not set" — the current value shown beside each editable question. */
export function currentAnswer(category, q, draft) {
  const v = draft.fields?.[q.field]
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return 'Not set'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.slice(0, 4).join(', ').slice(0, 60) + (v.length > 4 ? ` +${v.length - 4}` : '')
  const word = FIELD_WORDS[q.field]?.(v, category, draft.fields ?? {})
  return String(word ?? v).slice(0, 60)
}
export const privacySet = (exact) => `Map will show the *${exact ? 'exact pin' : 'approximate area'}*.`

// ── Publish / verification ───────────────────────────────────────────────

export const resubmitted = (category) =>
  `✅ Changes saved — your ${CATEGORIES[category]?.label ?? 'property'} is updated and back with our team for verification. I'll message you when it's live.`

export const editReopened = (status) =>
  status === 'REJECTED'
    ? `Let's fix it up. Here's your listing — change what was flagged, then hit Publish to resubmit.`
    : `Sure — your listing hasn't been approved yet, so we can still change it. Here's what it says now:`

export const editLive = (manageUrl) =>
  `That listing is already live, so edits happen on the website where you can see exactly what renters see.` +
  (manageUrl ? `

Tap to sign in and manage it (link works once, for 24 hours):
${manageUrl}` : `

Sign in at stayonmap.com to manage it.`)

export const editNotPossible = () =>
  `I couldn't find that listing any more — it may have been removed. Say *hi* to start a new one.`

export const multiSelectBody = (label, chosen) =>
  `${label}

` +
  (chosen.length ? `Selected: ${chosen.join(', ')}

` : '') +
  `Tap an option to add it — tap again to remove. You can also type names ("wifi, ac"). Tap *Done* when finished.`

export const submitted = (category, { email } = {}) =>
  `Thanks! 🙏 Your ${CATEGORIES[category]?.label ?? 'property'} has been submitted for verification.\n\n` +
  `Our team checks every listing before it goes on the map — usually within a day. I'll message you here the moment it's live.\n\n` +
  `📲 Meanwhile, manage your listing, chat with renters and get instant updates in the ${BRAND} app:\n${PLAY_STORE_URL}\n\n` +
  signInLine(email)

// The one way in for a WhatsApp owner: the email they gave here, and the
// emailed sign-in code (no password was ever set). Said the same way at every
// exit, so nobody hunts for a password they never had.
const signInLine = (email) =>
  `🔑 Always sign in with the email you registered this property under${email ? ` — *${email}*` : ''}: tap *Email me a sign-in code* on the login screen. No password needed.`

// ── Held for an incomplete profile (2026-09-02) ───────────────────────────
// The listing is saved as a draft; it goes to our team the moment the profile
// is complete. For a WhatsApp owner that is usually ONLY the verified email,
// and signing in with the emailed code is what verifies it — so step 1 is the
// whole job in the common case, and the copy says so instead of listing chores.

/** The site, opened straight onto the sign-in-code form with the email in. */
export const signInUrl = (loginUrl, email) =>
  email ? `${loginUrl}/?signin=${encodeURIComponent(email)}` : `${loginUrl}/`

export const heldForProfile = ({ email, missing = [], loginUrl }) => {
  const rest = missing.filter((m) => m.field !== 'email').map((m) => m.label)
  const link = signInUrl(loginUrl, email)
  const lines = [
    `✅ *Your listing is saved.* It is NOT with our team yet — one step first:`,
    ``,
    `*1. Sign in once with your email${email ? ` — *${email}*` : ''}.*`,
    `Tap this link (it opens the sign-in form with your email filled in):`,
    link,
    `Then tap *Email me a sign-in code*, open your inbox, and enter the code. No password needed.`,
    ``,
  ]
  if (rest.length) {
    lines.push(`*2. Fill in ${rest.join(' and ')}* under Settings after you sign in.`)
    lines.push(`Your listing goes to our team for verification the moment your profile is complete.`)
  } else {
    lines.push(`*2. That's all.* Signing in confirms your email, and your listing goes to our team for verification straight away — usually checked within a day.`)
  }
  lines.push(``)
  lines.push(`📧 I've also emailed these steps to ${email ?? 'your email'}.`)
  lines.push(`Always sign in with that email — it's the one your property is registered under. I'll message you here the moment your listing is live.`)
  return lines.join('\n')
}

export const heldNotificationBody = (missing = []) => {
  const rest = missing.filter((m) => m.field !== 'email').map((m) => m.label)
  return rest.length
    ? `Your WhatsApp listing is saved as a draft. Add ${rest.join(' and ')} under Settings — it is sent to our team for verification the moment your profile is complete.`
    : `Your WhatsApp listing is saved as a draft. Signing in confirmed your email, so it is being sent to our team for verification now.`
}

export const releasedForVerification = (category) =>
  `🎉 Profile complete — your ${CATEGORIES[category]?.label ?? 'property'} has been sent to our team for verification. I'll message you here the moment it's live.`

export const publishFailedValidation = (problems) =>
  `Almost there — a couple of things need fixing before it can go up:\n\n${problems.map((p) => `• ${p}`).join('\n')}`

export const publishFailedServer = () =>
  `Something went wrong on our side while publishing. Your answers are saved — I'll retry shortly, and our team has been notified.`

export const listingLive = ({ category, fields, locality, listingUrl, manageUrl }) =>
  `🎉 Your property is live on ${BRAND}.\n\n` +
  `${CATEGORIES[category]?.emoji ?? '🏠'} ${headline(category, fields)}\n` +
  `📍 ${locality ?? ''}\n` +
  `${priceLines(category, fields)[0] ?? ''}\n\n` +
  `View listing:\n${listingUrl}\n\n` +
  `Manage your property:\n${manageUrl}\n\n` +
  signInLine()

export const listingRejected = ({ note, manageUrl }) =>
  `Your listing couldn't be approved yet${note ? `: ${note}` : ''}.\n\nEdit it and resubmit here:\n${manageUrl}`

export const afterCompletion = (state, { email, loginUrl } = {}) =>
  state === 'live'
    ? `Your listing is live. Want to list another property? (Say *edit* for a link to manage the live one.)`
    : state === 'held'
      ? `Your listing is saved but *not yet sent for verification* — it goes to our team the moment you sign in once with${email ? ` *${email}*` : ' the email you gave here'}.\n\nTap this link, then *Email me a sign-in code*:\n${signInUrl(loginUrl ?? 'https://www.stayonmap.com', email)}\n\nYou can still *edit* the listing here, or list another property.`
      : `Your listing is with our team for verification — I'll message you when it's live. While it waits you can still *edit* it, or list another property.`

export const rateLimited = () => `You're sending messages faster than I can read them — give me a moment.`

export const notConfiguredForMedia = () => `I can't receive photos right now. Please try again in a few minutes.`

export const phoneLine = (e164) => toDisplay(e164)

// ── Helpers ──────────────────────────────────────────────────────────────

export function nounFor(category) {
  return { apartment: 'flat', house: 'house', land: 'plot', pg: 'PG', shop: 'space', stay: 'place' }[category] ?? 'property'
}

function photoHint(category) {
  return {
    apartment: 'Lead with the living room in daylight, then kitchen, bedrooms and balcony.',
    house:     'Start at the entrance, then the living spaces, terrace or garden.',
    land:      'Shoot the plot from the approach road, plus any boundary markers.',
    pg:        'Show a room, the bathroom, and the dining or common area.',
    shop:      'Lead with the frontage — it is what a business looks for first.',
    stay:      'Show where guests sleep, the bathroom, and the view.',
  }[category] ?? ''
}

export function headline(category, f) {
  switch (category) {
    case 'apartment': return `${bhk(f.bhk)} Apartment`
    case 'house':     return `${bhk(f.bhk)} ${f.houseStyle ?? 'House'}`
    case 'land':      return `${f.extent ?? ''} ${f.extentUnit ?? 'sq.ft'} ${(f.landType ?? '').toLowerCase()} plot — ${f.saleOrLease === 'SALE' ? 'for sale' : 'for lease'}`.replace(/\s+/g, ' ')
    case 'pg':        return `${f.pgName ? `${f.pgName} — ` : ''}${f.sharing === 1 ? 'Single' : `${f.sharing}-sharing`} PG${f.genderPreference === 'FEMALE' ? ' for women' : f.genderPreference === 'MALE' ? ' for men' : ''}`
    case 'shop':      return `${f.carpetArea ? `${f.carpetArea} sq.ft ` : ''}${f.commercialType ?? 'Commercial space'}`
    case 'stay':      return `${f.placeType ?? 'Stay'}${f.maxGuests ? `, sleeps ${f.maxGuests}` : ''}`
    default:          return 'Property'
  }
}

function bhk(n) { return n === 0 ? 'Studio' : n != null ? `${n} BHK` : '' }

function priceLines(category, f) {
  if (category === 'stay') {
    const lines = [`💰 ${money(f.nightlyRate ?? 0)}/night`]
    if (f.weekendRate) lines.push(`💰 ${money(f.weekendRate)}/night on weekends`)
    if (f.cleaningFee) lines.push(`🧹 ${money(f.cleaningFee)} cleaning fee`)
    return lines
  }
  if (category === 'land') return [`💰 ${money(f.rent ?? 0)}${f.saleOrLease === 'SALE' ? '' : '/year'}${f.priceNegotiable ? ' (negotiable)' : ''}`]
  const lines = []
  if (f.pricingModel === 'SALE') {
    lines.push(`💰 ${money(f.rent ?? 0)} asking price${f.priceNegotiable ? ' (negotiable)' : ''}`)
    if (f.deposit) lines.push(`💵 ${money(f.deposit)} booking advance`)
  } else if (f.pricingModel === 'LEASE') {
    lines.push(`💰 ${money(f.rent ?? 0)} lease (lump sum)`)
  } else {
    lines.push(`💰 ${money(f.rent ?? 0)}/month${category === 'pg' ? ' per bed' : ''}`)
    if (f.deposit != null) lines.push(`💵 ${money(f.deposit)} deposit`)
  }
  if (f.maintenance) lines.push(`🔧 ${money(f.maintenance)}/month maintenance`)
  return lines
}

const FIELD_WORDS = {
  bhk:            (v) => (v === 0 ? 'Studio' : `${v} BHK`),
  houseStyle:     (v) => v,
  rent:           (v, cat, f) => {
    if (cat === 'land') return `${money(v)}`
    if (f?.pricingModel === 'SALE') return `${money(v)} asking`
    if (f?.pricingModel === 'LEASE') return `${money(v)} lease`
    return `${money(v)}/month`
  },
  deposit:        (v, _c, f) => `${money(v)} ${f?.pricingModel === 'SALE' ? 'advance' : 'deposit'}`,
  maintenance:    (v) => `${money(v)}/mo maintenance`,
  pricingModel:   (v) => ({ RENT: 'For rent', LEASE: 'On lease', SALE: 'For sale' }[v] ?? null),
  leaseDuration:  (v) => `${v} mo minimum stay`,
  noticePeriodDays: (v) => `${v} days notice`,
  totalBeds:      (v) => `${v} beds total`,
  availableBeds:  (v) => `${v} beds free`,
  frontage:       (v) => `${v} ft frontage`,
  powerLoad:      (v) => `${v} kW power`,
  dimensions:     (v) => v,
  cleaningFee:    (v) => `${money(v)} cleaning fee`,
  weekendRate:    (v) => `${money(v)}/night weekends`,
  minNights:      (v) => `Min ${v} night${v === 1 ? '' : 's'}`,
  maxNights:      (v) => `Max ${v} nights`,
  instantBook:    (v) => (v ? 'Instant book' : null),
  beds:           (v) => `${v} bed${v === 1 ? '' : 's'}`,
  possessionStatus: (v) => v,
  loanEligible:   (v) => (v ? 'Bank loan available' : null),
  nightlyRate:    (v) => `${money(v)}/night`,
  furnished:      (v) => FURNISHED_WORD[v] ?? v,
  bathrooms:      (v) => `${v} bath`,
  parking:        (v) => (v ? 'Parking' : 'No parking'),
  floor:          (v) => (v === 0 ? 'Ground floor' : `Floor ${v}`),
  totalFloors:    (v) => `${v} floors`,
  area:           (v) => `${v} sq.ft built-up`,
  extent:         (v, _c, f) => `${v} ${f.extentUnit ?? 'sq.ft'}`,
  availableFrom:  (v) => `Available ${fmtDate(v)}`,
  amenities:      (v) => (v?.length ? v.slice(0, 5).join(', ') + (v.length > 5 ? ` +${v.length - 5}` : '') : null),
  rules:          (v, cat) => (v?.length ? v.map((k) => ruleWord(k, cat)).join(', ') : null),
  sharing:        (v) => (v === 1 ? 'Single sharing' : `${v}-sharing`),
  foodIncluded:   (v) => (v ? 'Food included' : 'Food not included'),
  foodCharges:    (v) => `Food ${money(v)}/month`,
  genderPreference: (v) => ({ ANY: 'Anyone', MALE: 'Men', FEMALE: 'Women' }[v] ?? v),
  landType:       (v) => v,
  approvalStatus: (v) => v,
  facingDirection:(v) => `${v[0]}${v.slice(1).toLowerCase()} facing`,
  roadWidth:      (v) => `${v} ft road`,
  priceNegotiable:(v) => (v ? 'Negotiable' : null),
  boundaryWall:   (v) => (v ? 'Boundary wall' : null),
  commercialType: (v) => v,
  carpetArea:     (v) => `${v} sq.ft`,
  suitableFor:    (v) => `Suits ${v}`,
  placeType:      (v) => v,
  maxGuests:      (v) => `${v} guests`,
  checkIn:        (v) => `Check-in ${v}`,
  checkOut:       (v) => `Check-out ${v}`,
  pgName:         (v) => v,
  curfewTime:     (v) => `Curfew ${v}`,
  visitContact:   (v) => `Contact by ${VISIT_CONTACT_WORDS[v] ?? v}`,
  appointmentWindowStart: (v) => `Visits from ${fmtTime(v)}`,
  appointmentWindowEnd:   (v) => `Visits until ${fmtTime(v)}`,
}

function ruleWord(k, cat) {
  // Same columns, per-type words: on a short stay bachelorAllowed is the
  // "couple friendly" claim, not a tenancy rule about bachelors.
  if (cat === 'stay') {
    const stay = { bachelorAllowed: 'Couples ok', familyPreferred: 'Family-friendly' }[k]
    if (stay) return stay
  }
  return { bachelorAllowed: 'Bachelors ok', familyPreferred: 'Families preferred', petsAllowed: 'Pets ok', nonVegAllowed: 'Non-veg ok', smokingAllowed: 'Smoking ok', visitorsAllowed: 'Visitors ok', curfew: 'Curfew' }[k] ?? k
}

function fmtDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function describeFields(category, fields, { skip = [], only = null } = {}) {
  const out = []
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (v === null || v === undefined || v === '') continue
    if (skip.includes(k) || (only && !only.includes(k))) continue
    if (k === 'details') continue
    const fn = FIELD_WORDS[k]
    if (!fn) continue
    const word = fn(v, category, fields)
    if (word) out.push(word)
  }
  return out
}

export function shortLabel(q) {
  return {
    location: 'Exact property location', photos: 'Property photos', rent: 'Rent', deposit: 'Deposit', bhk: 'Bedrooms',
    furnished: 'Furnishing', nightlyRate: 'Price per night', maxGuests: 'Maximum guests', extent: 'Plot size',
    extentUnit: 'Plot size unit', landType: 'Land type', approvalStatus: 'Approval status', sharing: 'Room sharing',
    foodIncluded: 'Food included?', genderPreference: 'Who it is for', commercialType: 'Type of space',
    carpetArea: 'Area', placeType: 'What guests book', houseStyle: 'Kind of house', saleOrLease: 'Sale or lease',
    pricingModel: 'Rent, lease or sale', salePrice: 'Asking price', maintenance: 'Maintenance',
    leaseDuration: 'Minimum stay', noticePeriodDays: 'Notice period', totalBeds: 'Total beds',
    availableBeds: 'Beds available', frontage: 'Frontage', powerLoad: 'Power load', dimensions: 'Plot dimensions',
    cleaningFee: 'Cleaning fee', weekendRate: 'Weekend rate', minNights: 'Minimum stay', maxNights: 'Maximum stay',
    instantBook: 'Instant booking', possessionStatus: 'Possession status', loanEligible: 'Bank loan',
    area: 'Built-up area', facingDirection: 'Facing', beds: 'Beds',
    visitContact: 'How renters contact you', visitFrom: 'Visits from', visitUntil: 'Visits until',
  }[q.id] ?? q.label.replace(/\?$/, '')
}

function emojiFor(q) {
  return { location: '📍', photos: '📸', rent: '💰', deposit: '💵', nightlyRate: '💰' }[q.id] ?? '•'
}
