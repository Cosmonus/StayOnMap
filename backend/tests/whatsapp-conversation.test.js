// The conversation engine, end to end, against an in-memory conversation
// store and a recording WhatsApp client. Every scenario the spec names:
// new, resume, cancel, restart, a duplicate message, unexpected input — and
// the whole path from "2bhk in Velachery…" to Publish.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

// ── Recording client ───────────────────────────────────────────────────────
const sent = []
vi.mock('../src/features/whatsapp/client.js', () => ({
  sendText:    vi.fn(async (to, body, o) => { sent.push({ to, kind: 'text', body, o }); return 'id' }),
  sendButtons: vi.fn(async (to, { body, buttons }, o) => { sent.push({ to, kind: 'buttons', body, buttons, o }); return 'id' }),
  sendList:    vi.fn(async (to, { body, rows }, o) => { sent.push({ to, kind: 'list', body, rows, o }); return 'id' }),
  sendTemplate: vi.fn(async () => 'id'),
  markRead: vi.fn(async () => {}),
  downloadMedia: vi.fn(),
  whatsappConfigured: () => true,
}))
const events = []
vi.mock('../src/features/whatsapp/analytics.js', () => ({ track: (conv, name, props) => events.push({ name, props }) }))
const resolveLocationInput = vi.fn()
vi.mock('../src/features/whatsapp/location.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveLocationInput: (...a) => resolveLocationInput(...a),
}))
const ingestPhoto = vi.fn()
vi.mock('../src/features/whatsapp/media.service.js', () => ({ ingestPhoto: (...a) => ingestPhoto(...a), MAX_PHOTOS: 10 }))
const publishFromConversation = vi.fn()
const propertyEditability = vi.fn()
vi.mock('../src/features/whatsapp/publish.service.js', () => ({
  publishFromConversation: (...a) => publishFromConversation(...a),
  propertyEditability: (...a) => propertyEditability(...a),
}))
vi.mock('../src/features/whatsapp/loginLink.service.js', () => ({ createLoginLink: vi.fn(async () => 'https://www.stayonmap.com/wa/login?token=t') }))

// ── In-memory conversation store on top of the Prisma mock ─────────────────
const store = { rows: new Map(), seq: 0, messages: new Set() }
function installStore() {
  prismaMock.whatsAppConversation.create.mockImplementation(async ({ data }) => {
    const row = { id: `c${++store.seq}`, propertyType: null, currentQuestion: null, completionPct: 0, propertyId: null, lastError: null, errorCount: 0, lastMessageAt: new Date(), createdAt: new Date(), ...data }
    store.rows.set(row.id, row); return { ...row }
  })
  prismaMock.whatsAppConversation.update.mockImplementation(async ({ where, data }) => {
    const row = store.rows.get(where.id)
    const { errorCount, ...rest } = data
    Object.assign(row, rest)
    if (errorCount?.increment) row.errorCount += errorCount.increment
    return { ...row }
  })
  prismaMock.whatsAppConversation.findFirst.mockImplementation(async ({ where }) => {
    const rows = [...store.rows.values()].filter((r) => r.phone === where.phone).sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    const open = where.status?.in
    const hit = rows.find((r) => (open ? open.includes(r.status) : true))
    return hit ? { ...hit } : null
  })
  prismaMock.whatsAppConversation.findUnique.mockImplementation(async ({ where }) => store.rows.get(where.id) ?? null)
  prismaMock.whatsAppMessage.create.mockImplementation(async ({ data }) => {
    if (store.messages.has(data.waMessageId)) {
      const { Prisma } = await import('@prisma/client')
      throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't' })
    }
    store.messages.add(data.waMessageId)
    return { id: `m_${data.waMessageId}`, ...data }
  })
}

const { handleInbound } = await import('../src/features/whatsapp/engine.js')
const { notifyUser } = await import('../src/features/notifications/notifications.service.js')

// A fresh number per test: the engine's per-number burst guard is module
// state, and one number across the whole file would trip it.
let PHONE = '919876543210'
let phoneSeq = 0
let seq = 0
const text = (body) => ({ id: `wamid.${++seq}`, type: 'text', text: { body } })
const reply = (id, title = id) => ({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title } } })
const pin = (lat, lng) => ({ id: `wamid.${++seq}`, type: 'location', location: { latitude: lat, longitude: lng } })
const image = (mediaId) => ({ id: `wamid.${++seq}`, type: 'image', image: { id: mediaId, mime_type: 'image/jpeg' } })
const say = (message) => handleInbound({ message, phone: PHONE, contactName: 'Asha Rao' })
const last = () => sent[sent.length - 1]
const conv = () => [...store.rows.values()].at(-1)

const CANDIDATE = { lat: 12.98, lng: 80.22, city: 'Chennai', locality: 'Velachery', address: '3rd Main Rd, Velachery', state: 'Tamil Nadu', pincode: '600042', precision: 'exact', source: 'pin', confirmed: false }

// The three closing questions (added 2026-09-02) sit AFTER the photos: how a
// renter should reach the owner, and the visiting window. Every path to the
// review passes through them.
async function answerVisitQuestions() {
  expect(conv().currentQuestion).toBe('visitContact')
  await say(reply('opt:visitContact:1', 'WhatsApp message'))
  expect(conv().currentQuestion).toBe('visitFrom')
  await say(text('10 am'))
  expect(conv().currentQuestion).toBe('visitUntil')
  await say(text('6 pm'))
}

beforeEach(() => {
  PHONE = `91987650${String(phoneSeq++).padStart(4, '0')}`
  sent.length = 0; events.length = 0
  store.rows.clear(); store.messages.clear(); store.seq = 0
  installStore()
  resolveLocationInput.mockReset().mockResolvedValue({ status: 'candidate', candidate: CANDIDATE })
  ingestPhoto.mockReset()
  publishFromConversation.mockReset()
  propertyEditability.mockReset().mockResolvedValue({ exists: true, editable: true, status: 'PENDING' })
  // Identity: no verified owner, no typed candidate → a fresh account.
  prismaMock.user.findFirst.mockReset().mockResolvedValue(null)
  prismaMock.user.findMany.mockReset().mockResolvedValue([])
  prismaMock.user.create.mockReset().mockImplementation(async ({ data }) => ({ id: 'u-new', isBusiness: false, showExactLocation: true, ...data }))
  // email set: the default owner has one, so the review-step email ask stays
  // out of every test that isn't about it (the ask fires only on email: null).
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ id: 'u-new', name: 'Asha Rao', email: 'asha@example.com', isBusiness: false, showExactLocation: true, role: 'OWNER' })
  prismaMock.user.update.mockReset().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }))
})

describe('starting', () => {
  it('a first message creates the owner and the conversation, welcomes them, and offers the six types', async () => {
    await say(text('hi'))
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.create.mock.calls[0][0].data).toMatchObject({ phone: PHONE.slice(2), email: null, role: 'OWNER', name: 'Asha Rao' })
    expect(sent[0].kind).toBe('text')
    expect(sent[0].body).toMatch(/Welcome to StayOnMap/)
    // The broker gate is the flow's first question, before the type list.
    expect(last().kind).toBe('buttons')
    expect(last().body).toMatch(/Are you a broker\?/)
    expect(last().buttons.map((b) => b.id)).toEqual(['act:broker:no', 'act:broker:yes'])
    await say(reply('act:broker:no'))
    expect(last().kind).toBe('list')
    expect(last().rows.map((r) => r.id)).toEqual(['type:apartment', 'type:house', 'type:land', 'type:pg', 'type:shop', 'type:stay'])
    expect(conv().status).toBe('PROPERTY_TYPE')
    expect(events.map((e) => e.name)).toContain('wa_conversation_started')
  })

  it('a broker who admits it is refused and the conversation ends', async () => {
    await say(text('hi'))
    await say(reply('act:broker:yes', "Yes, I'm a broker"))
    expect(conv().status).toBe('CANCELLED')
    expect(last().body).toMatch(/strictly owner-listed/)
    expect(events.map((e) => e.name)).toContain('wa_broker_rejected')
  })

  it('a typed "no" passes the gate, and gibberish re-asks it', async () => {
    await say(text('hi'))
    await say(text('maybe'))
    expect(last().body).toMatch(/Are you a broker\?/) // re-asked, nothing advanced
    await say(text('no'))
    expect(last().kind).toBe('list') // the type list — the gate is passed
    expect(conv().draft.flags.brokerOk).toBe(true)
  })

  it('a verified existing user is reused — never a second account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u-old', name: 'Ravi', phone: PHONE.slice(2), phoneVerifiedAt: new Date(), isBlocked: false, isBusiness: false })
    await say(text('hello'))
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(conv().userId).toBe('u-old')
  })

  it('an account that merely typed the number is OFFERED, and only the phone holder can accept', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-typed', email: 'asha@example.com', name: 'Asha' }])
    await say(text('hi'))
    expect(last().kind).toBe('buttons')
    expect(last().body).toMatch(/as\*+@example\.com/)
    expect(conv().userId).toBeNull()
    await say(reply('act:link:yes'))
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-typed' }, data: expect.objectContaining({ phoneVerifiedAt: expect.any(Date), role: 'OWNER' }) }))
    expect(conv().userId).toBe('u-typed')
    expect(conv().status).toBe('PROPERTY_TYPE')
  })

  it('a duplicate delivery of the same message is ignored entirely', async () => {
    const m = text('hi')
    await say(m)
    const n = sent.length
    await say(m)
    expect(sent.length).toBe(n)
    expect(store.rows.size).toBe(1)
  })

  it('a first message that already describes the property skips the type question and applies what it said', async () => {
    resolveLocationInput.mockResolvedValue({ status: 'imprecise', place: 'Velachery' })
    await say(text('2bhk apartment in Velachery, fully furnished, 28k rent, 1 lakh deposit, available September'))
    await say(reply('act:broker:no')) // the first message rides through the gate
    const c = conv()
    expect(c.propertyType).toBe('apartment')
    expect(c.draft.fields).toMatchObject({ bhk: 2, furnished: 'FULLY', rent: 28000, deposit: 100000 })
    expect(c.draft.fields.availableFrom).toMatch(/-09-01/)
    // It tried the typed place, found it is an area, and asked for a pin.
    expect(resolveLocationInput).toHaveBeenCalledWith({ kind: 'text', text: 'Velachery' })
    expect(sent.some((s) => s.kind === 'text' && /area, not a building/.test(s.body))).toBe(true)
    expect(events.map((e) => e.name)).toEqual(expect.arrayContaining(['wa_type_selected', 'wa_questionnaire_started']))
  })
})

describe('the questionnaire', () => {
  async function toApartment() {
    await say(text('hi'))
    await say(reply('act:broker:no'))
    await say({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'type:apartment', title: 'Apartment' } } })
  }

  it('after the type, the first question is the exact location — worded for a flat', async () => {
    await toApartment()
    expect(conv().status).toBe('LOCATION')
    expect(conv().currentQuestion).toBe('location')
    expect(last().body).toMatch(/exact location of the flat/)
  })

  it('a pin becomes a candidate to confirm; confirming stores it and moves on', async () => {
    await toApartment()
    await say(pin(12.98, 80.22))
    expect(last().kind).toBe('buttons')
    expect(last().body).toMatch(/Velachery, Chennai/)
    expect(conv().draft.location).toBeNull()
    await say(reply('act:loc:confirm', 'Confirm'))
    expect(conv().draft.location).toMatchObject({ ...CANDIDATE, confirmed: true })
    expect(events.map((e) => e.name)).toContain('wa_location_submitted')
    expect(conv().currentQuestion).toBe('bhk')
    expect(last().kind).toBe('list') // 6 BHK options → a list
  })

  it('"Change" discards the candidate and asks again', async () => {
    await toApartment()
    await say(pin(12.98, 80.22))
    await say(reply('act:loc:change', 'Change'))
    expect(conv().draft.location).toBeNull()
    expect(conv().draft.pending).toBeNull()
  })

  it('a missing pincode is asked for before moving on', async () => {
    resolveLocationInput.mockResolvedValue({ status: 'candidate', candidate: { ...CANDIDATE, pincode: null } })
    await toApartment()
    await say(pin(12.98, 80.22))
    await say(reply('act:loc:confirm'))
    expect(last().body).toMatch(/pincode/)
    await say(text('600042'))
    expect(conv().draft.location.pincode).toBe('600042')
    expect(conv().currentQuestion).toBe('bhk')
  })

  it('structured replies, sentences, and skips each land on the right field', async () => {
    await toApartment()
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(reply('opt:bhk:2', '2 BHK'))
    expect(conv().draft.fields.bhk).toBe(2)
    expect(conv().currentQuestion).toBe('pricingModel')
    await say(text('monthly rent'))
    expect(conv().draft.fields.pricingModel).toBe('RENT')
    expect(conv().currentQuestion).toBe('rent')
    await say(text('28k'))
    expect(conv().draft.fields.rent).toBe(28000)
    expect(conv().currentQuestion).toBe('deposit')
    await say(text('deposit is 1 lakh and it is semi furnished'))
    expect(conv().draft.fields).toMatchObject({ deposit: 100000, furnished: 'SEMI' })
    expect(conv().currentQuestion).toBe('maintenance') // furnished was answered in the sentence, so it was not asked
    await say(text('skip'))
    expect(conv().draft.fields.maintenance).toBeNull()
    expect(conv().currentQuestion).toBe('bathrooms')
  })

  it('unexpected input on a question re-asks it with a sentence, and counts the miss', async () => {
    await toApartment()
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(text('blah blah'))
    expect(conv().currentQuestion).toBe('bhk')
    expect(sent.at(-2).body).toMatch(/pick one of the options/i)
    expect(events.map((e) => e.name)).toContain('wa_extraction_failed')
  })

  it('a business category asks the business question first and upgrades on yes', async () => {
    await say(text('hi'))
    await say(reply('act:broker:no'))
    await say(text('I want to list my PG'))
    expect(last().kind).toBe('buttons')
    expect(last().body).toMatch(/business/)
    expect(conv().propertyType).toBeNull()
    await say(reply('act:biz:yes'))
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isBusiness: true }) }))
    expect(conv().propertyType).toBe('pg')
  })
})

describe('photos, review, publish', () => {
  async function toPhotos() {
    await say(text('2bhk apartment, fully furnished, 28k rent, 1 lakh deposit'))
    await say(reply('act:broker:no'))
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(text('monthly rent')) // pricingModel — required, asked before the money questions
    // maintenance, bathrooms, area, parking, floor, totalFloors, facing,
    // availableFrom, leaseDuration, noticePeriodDays, amenities, rules, details
    for (let i = 0; i < 13; i++) await say(text('skip'))
    expect(conv().currentQuestion).toBe('photos')
    expect(conv().status).toBe('PHOTOS')
  }

  it('photos are accepted whenever they arrive, deduped, and counted', async () => {
    ingestPhoto.mockImplementation(async (draft, media) => ({ status: 'added', photo: { url: `https://s/${media.id}_full.webp`, waMediaId: media.id, order: draft.photos.length } }))
    await say(text('2bhk apartment, fully furnished, 28k rent, 1 lakh deposit'))
    await say(reply('act:broker:no'))
    await say(image('early'))
    expect(conv().draft.photos).toHaveLength(1)
    expect(last().body).toMatch(/Received 1 photo/)
    ingestPhoto.mockResolvedValueOnce({ status: 'duplicate' })
    await say(image('early'))
    expect(last().body).toMatch(/already added/)
  })

  it('Done with no photos is refused; Done with photos moves to review with a per-type summary', async () => {
    await toPhotos()
    await say(reply('act:photos_done', 'Done'))
    expect(last().body).toMatch(/at least one photo/)
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/1_full.webp', waMediaId: 'p1', order: 0 } })
    await say(image('p1'))
    await say(reply('act:photos_done', 'Done'))
    // Photos done is not the end any more: the visit questions come last.
    expect(conv().status).toBe('QUESTIONNAIRE')
    await answerVisitQuestions()
    expect(conv().draft.fields).toMatchObject({ visitContact: 'WHATSAPP', appointmentWindowStart: '10:00', appointmentWindowEnd: '18:00' })
    expect(conv().status).toBe('REVIEW')
    expect(last().kind).toBe('buttons')
    expect(last().buttons.map((b) => b.id)).toEqual(['act:publish', 'act:edit', 'act:cancel'])
    expect(last().body).toMatch(/2 BHK Apartment/)
    expect(last().body).toMatch(/Visits 10 AM – 6 PM/)
    expect(last().body).toMatch(/reach you by WhatsApp/)
    expect(last().body).toMatch(/₹28,000\/month/)
    expect(last().body).toMatch(/₹1,00,000 deposit/)
    expect(last().body).toMatch(/Velachery, Chennai/)
    expect(last().body).toMatch(/1 photos/)
    expect(last().body).toMatch(/exact pin/)
    expect(events.map((e) => e.name)).toEqual(expect.arrayContaining(['wa_photos_submitted', 'wa_draft_completed', 'wa_review_shown']))
  })

  async function toReview() {
    await toPhotos()
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/1_full.webp', waMediaId: 'p1', order: 0 } })
    await say(image('p1'))
    await say(reply('act:photos_done', 'Done'))
    await answerVisitQuestions()
  }

  it('the visiting window is checked as it is typed — an end before the start, or a time outside 9–8, is refused with a sentence', async () => {
    await toPhotos()
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/1_full.webp', waMediaId: 'p1', order: 0 } })
    await say(image('p1'))
    await say(reply('act:photos_done', 'Done'))
    await say(reply('opt:visitContact:0', 'Phone call'))
    await say(text('7 am'))
    expect(sent.at(-2).body).toMatch(/between 9 AM and 8 PM/)
    expect(conv().currentQuestion).toBe('visitFrom')
    await say(text('6'))  // a bare number is ambiguous — never guessed
    expect(sent.at(-2).body).toMatch(/like 10 AM or 5:30 PM/)
    await say(text('11:30 am'))
    expect(conv().draft.fields.appointmentWindowStart).toBe('11:30')
    await say(text('10 am'))  // before the start
    expect(sent.at(-2).body).toMatch(/not after your start time/)
    expect(conv().currentQuestion).toBe('visitUntil')
    await say(text('5.30pm'))
    expect(conv().draft.fields.appointmentWindowEnd).toBe('17:30')
    expect(conv().status).toBe('REVIEW')
    expect(last().body).toMatch(/Visits 11:30 AM – 5:30 PM/)
    expect(last().body).toMatch(/reach you by phone call/)
  })

  it('a short stay is asked how to be contacted but never for a viewing window — it is booked as dates', async () => {
    await say(text('hi'))
    await say(reply('act:broker:no'))
    await say({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'type:stay', title: 'Stay' } } })
    await say(reply('act:biz:yes'))
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    const ids = (await import('../src/features/whatsapp/questionnaire/schemas.js')).getQuestionnaire('stay').map((q) => q.id)
    expect(ids).toContain('visitContact')
    expect(ids).not.toContain('visitFrom')
    expect(ids).not.toContain('visitUntil')
  })

  it('"approximate" switches the owner\'s map privacy and re-shows the review', async () => {
    await toReview()
    await say(text('approximate'))
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { showExactLocation: false } }))
  })

  it('Edit shows the section, then ONE question to change — nothing is wiped', async () => {
    await toReview()
    await say(reply('act:edit', 'Edit'))
    expect(last().kind).toBe('list')
    await say({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'edit:price', title: 'Price' } } })
    // The picker lists the price questions with their CURRENT answers — the
    // old behaviour deleted the whole section here and re-asked all of it.
    expect(last().kind).toBe('list')
    expect(last().rows.map((r) => r.id)).toContain('eq:rent')
    expect(last().rows.find((r) => r.id === 'eq:rent').description).toMatch(/28,000/)
    expect(conv().draft.fields.rent).toBe(28000) // NOT wiped
    await say(reply('eq:rent'))
    expect(conv().currentQuestion).toBe('rent')
    await say(text('30k'))
    // Only rent changed; the deposit kept its answer, and the review returned.
    expect(conv().draft.fields).toMatchObject({ rent: 30000, deposit: 100000 })
    expect(conv().status).toBe('REVIEW')
  })

  it('adding one amenity later touches nothing else — the toggle list opens with current ticks', async () => {
    await toReview()
    await say(reply('act:edit', 'Edit'))
    await say({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'edit:details', title: 'Property details' } } })
    await say(reply('eq:amenities'))
    expect(last().kind).toBe('list')
    expect(last().rows.map((r) => r.id)).toContain('ms:amenities:done')
    await say(reply('ms:amenities:2', 'Lift'))
    await say(reply('ms:amenities:done', 'Done'))
    expect(conv().draft.fields.amenities).toContain('Lift')
    expect(conv().draft.fields.bhk).toBe(2) // untouched
    expect(conv().status).toBe('REVIEW')
  })

  it('adding only photos: Edit → Photos keeps everything and returns to review after Done', async () => {
    await toReview()
    await say(reply('act:edit', 'Edit'))
    await say({ id: `wamid.${++seq}`, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'edit:photos', title: 'Photos' } } })
    expect(conv().currentQuestion).toBe('photos')
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/2_full.webp', waMediaId: 'p2', order: 1 } })
    await say(image('p2'))
    await say(reply('act:photos_done', 'Done'))
    expect(conv().draft.photos).toHaveLength(2)
    expect(conv().draft.fields.rent).toBe(28000) // untouched
    expect(conv().status).toBe('REVIEW')
  })

  it('Publish creates the listing through the front door and moves to VERIFICATION', async () => {
    publishFromConversation.mockResolvedValue({ ok: true, property: { id: 'prop-1', status: 'PENDING' } })
    await toReview()
    await say(reply('act:publish', 'Publish'))
    expect(publishFromConversation).toHaveBeenCalledTimes(1)
    expect(conv().status).toBe('VERIFICATION')
    expect(conv().propertyId).toBe('prop-1')
    expect(last().body).toMatch(/submitted for verification/)
    expect(events.map((e) => e.name)).toContain('wa_publish_confirmed')
  })

  it('Publish tells the owner to sign in with the email they gave here — the emailed code, no password', async () => {
    publishFromConversation.mockResolvedValue({ ok: true, property: { id: 'prop-1', status: 'PENDING' } })
    await toReview()
    await say(reply('act:publish', 'Publish'))
    expect(last().body).toMatch(/sign in with the email you registered this property under — \*asha@example\.com\*/)
    expect(last().body).toMatch(/Email me a sign-in code/)
  })

  it('an incomplete profile HOLDS the listing: saved as a draft, told how to sign in, and notified in the app', async () => {
    publishFromConversation.mockResolvedValue({ ok: true, held: true, property: { id: 'prop-1', status: 'DRAFT' }, missing: [{ field: 'email', label: 'Verified email' }] })
    await toReview()
    await say(reply('act:publish', 'Publish'))
    expect(conv().status).toBe('AWAITING_PROFILE')
    expect(conv().propertyId).toBe('prop-1')
    expect(last().kind).toBe('text')
    expect(last().body).toMatch(/Your listing is saved/)
    expect(last().body).toMatch(/\*asha@example\.com\*/)
    expect(last().body).toMatch(/Email me a sign-in code/)
    expect(last().body).toMatch(/signing in with the code verifies your email/)
    // notifications.service is stubbed globally (tests/setup.js); the stub is the receipt.
    expect(notifyUser).toHaveBeenCalledWith('u-new', expect.objectContaining({ type: 'SYSTEM', audience: 'OWNER', referenceId: 'prop-1', referenceType: 'Property', push: true }))
    // The number has no OPEN conversation now; a later message says what is waiting.
    await say(text('thanks'))
    expect(last().body).toMatch(/not yet sent for verification/)
    expect(last().body).toMatch(/asha@example\.com/)
    expect(last().buttons.map((b) => b.id)).toEqual(['act:another', 'act:edit:sub', 'act:no'])
    expect(store.rows.size).toBe(1)
  })

  it('a held listing names the other missing fields when the email is not the only gap', async () => {
    publishFromConversation.mockResolvedValue({ ok: true, held: true, property: { id: 'prop-1', status: 'DRAFT' }, missing: [{ field: 'name', label: 'Your name' }, { field: 'email', label: 'Verified email' }] })
    await toReview()
    await say(reply('act:publish', 'Publish'))
    expect(last().body).toMatch(/Open \*Settings\* and fill in: Your name/)
  })

  it('a validation failure re-asks the offending question instead of showing a schema error', async () => {
    publishFromConversation.mockResolvedValue({ ok: false, kind: 'validation', problems: ['Monthly rent — too high'], reask: ['rent'] })
    await toReview()
    await say(reply('act:publish'))
    expect(conv().status).toBe('QUESTIONNAIRE')
    expect(conv().currentQuestion).toBe('rent')
    expect(sent.at(-2).body).toMatch(/Monthly rent — too high/)
  })

  it('a server failure keeps the draft, records the error for admin, and stays at review', async () => {
    publishFromConversation.mockResolvedValue({ ok: false, kind: 'error', error: 'db down' })
    await toReview()
    await say(reply('act:publish'))
    expect(conv().status).toBe('REVIEW')
    expect(conv().lastError).toMatch(/db down/)
    expect(conv().errorCount).toBe(1)
    expect(events.map((e) => e.name)).toContain('wa_publish_failed')
  })

  it('after submission the number has no open conversation; a message is answered with "list another?"', async () => {
    publishFromConversation.mockResolvedValue({ ok: true, property: { id: 'prop-1' } })
    await toReview()
    await say(reply('act:publish'))
    await say(text('thanks'))
    expect(last().buttons.map((b) => b.id)).toEqual(['act:another', 'act:edit:sub', 'act:no'])
    expect(store.rows.size).toBe(1)
    await say(reply('act:another'))
    expect(store.rows.size).toBe(2)
  })
})

describe('commands', () => {
  it('cancel ends the conversation; the next hello starts a new one', async () => {
    await say(text('2bhk flat, 28k rent'))
    await say(text('cancel'))
    expect(conv().status).toBe('CANCELLED')
    expect(events.map((e) => e.name)).toContain('wa_conversation_cancelled')
    await say(text('hi'))
    expect(store.rows.size).toBe(2)
  })

  it('restart asks first, then starts over', async () => {
    await say(text('2bhk flat, 28k rent'))
    await say(text('restart'))
    expect(last().buttons.map((b) => b.id)).toEqual(['act:restart:yes', 'act:restart:no'])
    await say(reply('act:restart:no'))
    expect([...store.rows.values()][0].status).not.toBe('CANCELLED')
    await say(text('restart')); await say(reply('act:restart:yes'))
    expect([...store.rows.values()][0].status).toBe('CANCELLED')
    expect(store.rows.size).toBe(2)
  })

  it('status reports progress and what is still needed', async () => {
    await say(text('2bhk flat, 28k rent'))
    await say(reply('act:broker:no'))
    await say(text('status'))
    expect(last().body).toMatch(/Apartment.*is \d+% done/)
    expect(last().body).toMatch(/Exact property location/)
  })

  it('resuming after a long silence greets and re-asks the current question', async () => {
    await say(text('2bhk flat, 28k rent'))
    await say(reply('act:broker:no'))
    conv().lastMessageAt = new Date(Date.now() - 8 * 3_600_000)
    await say(text('hi'))
    expect(sent.at(-2).body).toMatch(/Welcome back/)
    expect(last().body).toMatch(/exact location/)
  })
})

// ── The email ask — at the START, required (changed 2026-09-02) ───────────
// The phone needs no question — the WhatsApp number IS the verified phone.
// Email is asked right after the broker gate whenever the account has none,
// and the flow does not move on without one. The single exception: an address
// already on another account, where Skip is offered because there is no other
// way through. A chat message never overwrites an existing address
// (identity.setEmailIfEmpty).
describe('the email ask', () => {
  const noEmailUser = { id: 'u-new', name: 'Asha Rao', email: null, isBusiness: false, showExactLocation: true, role: 'OWNER' }

  it('an account without an email is asked right after the gate, and the type list follows a valid reply', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...noEmailUser })
    prismaMock.user.updateMany = vi.fn().mockResolvedValue({ count: 1 })
    await say(text('hi'))
    await say(reply('act:broker:no'))
    expect(last().kind).toBe('text')
    expect(last().body).toMatch(/email address/i)
    expect(conv().draft.flags.emailAsked).toBe(true)
    expect(conv().propertyType).toBeNull()
    await say(text('Asha.Rao@Example.com'))
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u-new', email: null }, data: { email: 'asha.rao@example.com' } })
    expect(sent.some((s) => s.kind === 'text' && /Saved asha\.rao@example\.com/.test(s.body))).toBe(true)
    expect(last().kind).toBe('list') // the type list — the flow carries on
    expect(conv().status).toBe('PROPERTY_TYPE')
  })

  it('a first message that describes the property rides through the email ask, like it rides through the gate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...noEmailUser })
    prismaMock.user.updateMany = vi.fn().mockResolvedValue({ count: 1 })
    resolveLocationInput.mockResolvedValue({ status: 'imprecise', place: 'Velachery' })
    await say(text('2bhk apartment in Velachery, 28k rent'))
    await say(reply('act:broker:no'))
    expect(last().body).toMatch(/email address/i)
    await say(text('asha@example.com'))
    expect(conv().propertyType).toBe('apartment')
    expect(conv().draft.fields).toMatchObject({ bhk: 2, rent: 28000 })
  })

  it('gibberish and "skip" both re-ask — the question is required', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...noEmailUser })
    await say(text('hi'))
    await say(reply('act:broker:no'))
    await say(text('not an email'))
    expect(last().body).toMatch(/doesn't look like an email/)
    await say(text('skip'))
    expect(last().body).toMatch(/doesn't look like an email/)
    expect(conv().status).toBe('PROPERTY_TYPE')
    expect(conv().draft.pending?.kind).toBe('email')
    expect(sent.filter((s) => s.kind === 'list').length).toBe(0) // never reached the types
  })

  it('an email already on another account is told, and only then may be skipped', async () => {
    const { Prisma } = await import('@prisma/client')
    prismaMock.user.findUnique.mockResolvedValue({ ...noEmailUser })
    prismaMock.user.updateMany = vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't' }))
    await say(text('hi'))
    await say(reply('act:broker:no'))
    await say(text('taken@example.com'))
    expect(last().body).toMatch(/already in use/)
    expect(conv().draft.pending).toMatchObject({ kind: 'email', allowSkip: true })
    await say(text('skip'))
    expect(last().kind).toBe('list')
    expect(conv().draft.pending).toBeNull()
  })

  it('an owner who already has an email is never asked, at the start or at review', async () => {
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/1_full.webp', waMediaId: 'p1', order: 0 } })
    await say(text('2bhk apartment, fully furnished, 28k rent, 1 lakh deposit'))
    await say(reply('act:broker:no'))
    expect(last().body).not.toMatch(/email/i)
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(text('monthly rent'))
    for (let i = 0; i < 13; i++) await say(text('skip'))
    await say(image('p1'))
    await say(reply('act:photos_done', 'Done'))
    await answerVisitQuestions()
    expect(conv().status).toBe('REVIEW')
    expect(sent.filter((s) => /email address/i.test(s.body)).length).toBe(0)
  })
})

// ── Tap-to-toggle multi-select (added 2026-09-01) ──────────────────────────
// WhatsApp has no multi-select control; the pattern is a list where each tap
// toggles an option (re-sent with ✓), pages of 8 with a More row, and a Done
// row that finishes. Typing still works and MERGES with what is ticked.
describe('multi-select by tapping', () => {
  async function toAmenities() {
    await say(text('2bhk apartment, fully furnished, 28k rent, 1 lakh deposit'))
    await say(reply('act:broker:no'))
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(text('monthly rent'))
    for (let i = 0; i < 10; i++) await say(text('skip')) // maintenance..noticePeriodDays
    expect(conv().currentQuestion).toBe('amenities')
  }

  it('the question arrives as a list: 8 options, Done, and More (15 options = 2 pages)', async () => {
    await toAmenities()
    expect(last().kind).toBe('list')
    const ids = last().rows.map((r) => r.id)
    expect(ids).toHaveLength(10)
    expect(ids.slice(0, 8).every((id) => /^ms:amenities:\d+$/.test(id))).toBe(true)
    expect(ids[8]).toBe('ms:amenities:done')
    expect(ids[9]).toBe('ms:amenities:more:1')
  })

  it('a tap toggles and re-shows with a ✓; a second tap removes; Done moves on', async () => {
    await toAmenities()
    await say(reply('ms:amenities:0', 'WiFi'))
    expect(conv().draft.fields.amenities).toEqual(['WiFi'])
    expect(last().kind).toBe('list')
    expect(last().rows[0].title).toBe('✓ WiFi')
    expect(last().body).toMatch(/Selected: WiFi/)
    await say(reply('ms:amenities:1', 'AC'))
    expect(conv().draft.fields.amenities).toEqual(['WiFi', 'AC'])
    await say(reply('ms:amenities:0', 'WiFi'))
    expect(conv().draft.fields.amenities).toEqual(['AC'])
    await say(reply('ms:amenities:done', 'Done'))
    expect(conv().currentQuestion).toBe('rules')
    expect(last().kind).toBe('list') // rules is multi-select too
    expect(last().rows.map((r) => r.id)).toContain('ms:rules:done')
  })

  it('More pages to the second page, where global indexes keep working', async () => {
    await toAmenities()
    await say(reply('ms:amenities:more:1', 'More options'))
    expect(last().rows[0].id).toBe('ms:amenities:8')
    await say(reply('ms:amenities:8', 'Security Guard'))
    expect(conv().draft.fields.amenities).toEqual(['Security Guard'])
    // Re-shown on the SAME page the tap came from.
    expect(last().rows[0].id).toBe('ms:amenities:8')
    expect(last().rows[0].title).toMatch(/^✓ /)
  })

  it('typing adds to what is ticked instead of replacing it; Done with nothing means none', async () => {
    await toAmenities()
    await say(reply('ms:amenities:0', 'WiFi'))
    await say(text('gym and lift'))
    expect(conv().draft.fields.amenities).toEqual(expect.arrayContaining(['WiFi', 'Lift', 'Gym']))
    // Typed answers advance (they always did); now at rules — Done with none.
    expect(conv().currentQuestion).toBe('rules')
    await say(reply('ms:rules:done', 'Done'))
    expect(conv().draft.fields.rules).toEqual([])
    expect(conv().currentQuestion).toBe('details')
  })
})

// ── Editing after submission (added 2026-09-01) ────────────────────────────
// While the listing is DRAFT / PENDING / REJECTED, "edit" reopens the SAME
// conversation at its review, and Publish becomes an UPDATE of the same
// Property. A live listing is edited on the website — the ask is answered
// with a manage link, never a second listing.
describe('editing a submitted listing', () => {
  async function submit() {
    publishFromConversation.mockResolvedValue({ ok: true, property: { id: 'prop-1', status: 'PENDING' } })
    await toReviewGlobal()
    await say(reply('act:publish'))
    expect(conv().status).toBe('VERIFICATION')
  }
  async function toReviewGlobal() {
    await say(text('2bhk apartment, fully furnished, 28k rent, 1 lakh deposit'))
    await say(reply('act:broker:no'))
    await say(pin(12.98, 80.22)); await say(reply('act:loc:confirm'))
    await say(text('monthly rent'))
    for (let i = 0; i < 10; i++) await say(text('skip'))
    await say(reply('ms:amenities:done')); await say(reply('ms:rules:done')); await say(text('skip'))
    ingestPhoto.mockResolvedValue({ status: 'added', photo: { url: 'https://s/1_full.webp', waMediaId: 'p1', order: 0 } })
    await say(image('p1'))
    await say(reply('act:photos_done', 'Done'))
    await answerVisitQuestions()
    expect(conv().status).toBe('REVIEW')
  }

  it('"edit" while pending reopens the same conversation at review; Publish updates, not creates', async () => {
    await submit()
    await say(text('edit'))
    expect(propertyEditability).toHaveBeenCalledWith('prop-1', 'u-new')
    expect(conv().status).toBe('REVIEW')
    expect(store.rows.size).toBe(1) // the SAME conversation, not a new one
    expect(sent.some((s) => s.kind === 'text' && /hasn't been approved yet/.test(s.body))).toBe(true)
    // Change the rent at the review, then publish again.
    await say(text('rent is 30k'))
    expect(conv().draft.fields.rent).toBe(30000)
    publishFromConversation.mockResolvedValue({ ok: true, updated: true, property: { id: 'prop-1', status: 'PENDING' } })
    await say(reply('act:publish'))
    expect(conv().status).toBe('VERIFICATION')
    expect(sent.some((s) => s.kind === 'text' && /Changes saved/.test(s.body))).toBe(true)
  })

  it('the post-submission prompt offers Edit, and the button reopens too', async () => {
    await submit()
    await say(text('thanks'))
    expect(last().buttons.map((b) => b.id)).toContain('act:edit:sub')
    await say(reply('act:edit:sub', 'Edit that listing'))
    expect(conv().status).toBe('REVIEW')
  })

  it('a live listing is not reopened — the ask is answered with a manage link', async () => {
    await submit()
    store.rows.get(conv().id).status = 'COMPLETED'
    propertyEditability.mockResolvedValue({ exists: true, editable: false, status: 'ACTIVE' })
    await say(text('edit'))
    expect(conv().status).toBe('COMPLETED')
    expect(sent.some((s) => s.kind === 'text' && /already live/.test(s.body) && /wa\/login/.test(s.body))).toBe(true)
  })

  it('a listing deleted underneath the conversation is reported, not resurrected', async () => {
    await submit()
    propertyEditability.mockResolvedValue({ exists: false, editable: false, status: null })
    await say(text('edit'))
    expect(conv().status).toBe('VERIFICATION')
    expect(sent.some((s) => s.kind === 'text' && /couldn't find that listing/.test(s.body))).toBe(true)
  })
})
