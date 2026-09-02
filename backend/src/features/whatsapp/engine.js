// The conversation engine — one inbound message in, zero or more replies out,
// one conversation row updated.
//
// Shape of every turn:
//   1. record the message (idempotent — a Meta retry stops here)
//   2. load the open conversation for this number, or start one
//   3. global commands (cancel / restart / help / status) and pending
//      confirmations (link this account? your email? confirm this location?)
//      win over whatever question is in flight
//   4. media and locations are accepted in ANY state — an owner who sends six
//      photos before being asked is not wrong
//   5. text is tried against the current question first, then the extractor,
//      and only then declared not understood
//   6. persist, and ask the next unanswered question (or show the review)
//
// Turns for one number are serialised in-process: WhatsApp delivers a burst
// of photos as separate webhooks, and two turns reading and writing the same
// draft concurrently would lose one of them.
//
// This file knows WhatsApp (buttons, lists, media ids). It does NOT know how
// to validate an answer (questionnaire/engine.js), how to read a sentence
// (extract/), where a pin is (location.service.js), or how a listing is made
// (publish.service.js). Keep it that way — the whole point of the split is
// that those four are testable without a webhook.
import * as conversations from './conversation.service.js'
import * as identity from './identity.service.js'
import * as copy from './copy.js'
import { track } from './analytics.js'
import { sendText, sendButtons, sendList, markRead } from './client.js'
import { extractFields } from './extract/index.js'
import { resolveLocationInput, looksLikeMapsLink, coordsFromText } from './location.service.js'
import { ingestPhoto, MAX_PHOTOS } from './media.service.js'
import { publishFromConversation, propertyEditability } from './publish.service.js'
import { createLoginLink } from './loginLink.service.js'
import { CATEGORIES, CATEGORY_KEYS, SECTIONS, getQuestionnaire } from './questionnaire/schemas.js'
import {
  nextQuestion, findQuestion, missingRequired, completion, parseAnswer,
  questionsInSection, questionLabel, isVisible,
} from './questionnaire/engine.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

const RESUME_AFTER_MS = 6 * 60 * 60 * 1000
const BURST_WINDOW_MS = 60_000
const BURST_MAX = 40

// ── Per-number serialisation ───────────────────────────────────────────────
const chains = new Map()
const bursts = new Map()

export function handleInbound(input) {
  const key = input.phone
  const prev = chains.get(key) ?? Promise.resolve()
  const next = prev.then(() => processTurn(input)).catch((err) => intelError('whatsapp.turn_failed', err, { phone: input.phone?.slice(-4) }))
  chains.set(key, next)
  next.finally(() => { if (chains.get(key) === next) chains.delete(key) })
  return next
}

function overBurst(phone) {
  const now = Date.now()
  const list = (bursts.get(phone) ?? []).filter((t) => now - t < BURST_WINDOW_MS)
  list.push(now)
  bursts.set(phone, list)
  return list.length > BURST_MAX
}

// ── Message classification ─────────────────────────────────────────────────

export function classify(message) {
  switch (message?.type) {
    case 'text': return { kind: 'text', text: String(message.text?.body ?? '').trim() }
    case 'interactive': {
      const r = message.interactive?.button_reply ?? message.interactive?.list_reply
      return r?.id ? { kind: 'reply', id: r.id, title: r.title ?? '' } : { kind: 'other' }
    }
    case 'button': return message.button?.payload ? { kind: 'reply', id: message.button.payload, title: message.button.text ?? '' } : { kind: 'other' }
    case 'location': {
      const l = message.location ?? {}
      return { kind: 'location', lat: Number(l.latitude), lng: Number(l.longitude), name: l.name ?? null, address: l.address ?? null }
    }
    case 'image': return { kind: 'image', media: message.image }
    case 'document':
      return /^image\//.test(message.document?.mime_type ?? '') ? { kind: 'image', media: message.document } : { kind: 'other' }
    default: return { kind: 'other' }
  }
}

const norm = (s) => String(s ?? '').trim().toLowerCase()
const isCmd = (msg, ...words) => msg.kind === 'text' && words.includes(norm(msg.text))
const isReply = (msg, id) => msg.kind === 'reply' && msg.id === id
const GREETINGS = ['hi', 'hello', 'hey', 'hai', 'start', 'list', 'list property', 'namaste', 'vanakkam', 'hi there', 'hello there']

// ── The turn ───────────────────────────────────────────────────────────────

async function processTurn({ message, phone, contactName }) {
  let conv = await conversations.findOpen(phone)
  const { row, duplicate } = await conversations.recordInbound(message, { phone, conversationId: conv?.id })
  if (duplicate) return
  markRead(message.id).catch(() => {})

  if (overBurst(phone)) {
    await sendText(phone, copy.rateLimited(), { conversationId: conv?.id })
    await conversations.markProcessed(row.id, { conversationId: conv?.id, error: 'burst' })
    return
  }

  const msg = classify(message)
  try {
    conv = conv ? await continueConversation(conv, msg, contactName) : await startConversation(phone, msg, contactName)
    await conversations.markProcessed(row.id, { conversationId: conv?.id ?? null })
  } catch (err) {
    intelError('whatsapp.turn_error', err, { conversationId: conv?.id })
    await conversations.markProcessed(row.id, { conversationId: conv?.id ?? null, error: err.message })
    if (conv) await conversations.save(conv, { lastError: err.message }).catch(() => {})
    await sendText(phone, copy.publishFailedServer(), { conversationId: conv?.id })
  }
}

// ── Turn context helpers ───────────────────────────────────────────────────

function ctxFor(conv) {
  const o = { conversationId: conv.id }
  return {
    conv,
    say: (text) => sendText(conv.phone, text, o),
    buttons: (body, buttons, extra) => sendButtons(conv.phone, { body, buttons, ...extra }, o),
    list: (body, rows, extra) => sendList(conv.phone, { body, rows, ...extra }, o),
    persist: async (patch = {}) => {
      const updated = await conversations.save(conv, { ...patch, draft: conv.draft })
      Object.assign(conv, updated)
      return conv
    },
  }
}

const fields = (conv) => (conv.draft.fields ??= {})

// ── Starting ───────────────────────────────────────────────────────────────

async function startConversation(phone, msg, contactName) {
  const latest = await conversations.findLatest(phone)

  // After a submission the number has no OPEN conversation, but a reply still
  // deserves an answer. "Edit" reopens the SAME conversation while the listing
  // is still DRAFT / PENDING / REJECTED; a live listing is edited on the
  // website, so that ask is answered with a fresh manage link. Everything else
  // gets "want to list another?" — unless the message itself already describes
  // a new property.
  if (latest && ['VERIFICATION', 'COMPLETED'].includes(latest.status) && !isReply(msg, 'act:another')) {
    const wantsEdit = isReply(msg, 'act:edit:sub') || isCmd(msg, 'edit', 'edit listing', 'change', 'update', 'update listing')
    if (wantsEdit) return reopenForEdit(latest)
    const looksNew = msg.kind === 'text' && (await extractFields(msg.text)).hadSignal
    if (!looksNew) {
      const pendingButtons = [
        { id: 'act:another', title: 'Yes, list another' },
        { id: 'act:edit:sub', title: 'Edit that listing' },
        { id: 'act:no', title: 'Not now' },
      ]
      await sendButtons(phone, {
        body: copy.afterCompletion(latest.status === 'COMPLETED' ? 'live' : 'pending'),
        buttons: latest.status === 'COMPLETED' ? [pendingButtons[0], pendingButtons[2]] : pendingButtons,
      }, { conversationId: latest.id })
      return latest
    }
  }
  if (isReply(msg, 'act:no')) return latest

  const conv = await conversations.create(phone)
  conv.draft = conversations.emptyDraft()
  track(conv, 'wa_conversation_started')
  const ctx = ctxFor(conv)

  const verified = await identity.findVerifiedOwner(phone)
  if (verified) {
    if (verified.isBlocked) { await ctx.say('This account cannot list properties.'); await conversations.cancel(conv); return conv }
    conv.userId = verified.id
    conv.draft.flags.name = verified.name
    await ctx.persist({ userId: verified.id, status: 'PROPERTY_TYPE' })
    await ctx.say(copy.welcome(firstName(verified.name)))
    return handleTypeSelection(ctx, msg)
  }

  const candidate = await identity.findUnverifiedCandidate(phone)
  if (candidate?.email) {
    conv.draft.pending = { kind: 'link', userId: candidate.id, name: candidate.name, firstMessage: msg }
    await ctx.persist({ status: 'START' })
    await ctx.say(copy.welcome(firstName(contactName)))
    await ctx.buttons(copy.linkOffer(identity.maskEmail(candidate.email)), [
      { id: 'act:link:yes', title: "Yes, that's me" }, { id: 'act:link:no', title: 'No, new account' },
    ])
    return conv
  }

  const user = await identity.createWhatsAppOwner(phone, { name: contactName })
  conv.userId = user.id
  conv.draft.flags.name = user.name
  await ctx.persist({ userId: user.id, status: 'PROPERTY_TYPE' })
  await ctx.say(copy.welcome(firstName(contactName)))
  return handleTypeSelection(ctx, msg)
}

const firstName = (name) => (name ? String(name).trim().split(/\s+/)[0] : '')

/**
 * "Edit" after submission: reopen the SAME conversation at its review — the
 * draft still holds every answer, so the ordinary Edit flow works unchanged
 * and Publish becomes an UPDATE of the same Property (publish.service.js).
 * Only while the listing is DRAFT / PENDING / REJECTED; a live one gets a
 * manage link instead, because the full wizard owns edits renters can see.
 */
async function reopenForEdit(conv) {
  conv.draft ??= conversations.emptyDraft()
  conv.draft.fields ??= {}; conv.draft.photos ??= []; conv.draft.flags ??= {}
  const ctx = ctxFor(conv)
  const check = await propertyEditability(conv.propertyId, conv.userId)
  if (!check.editable) {
    if (check.status === 'ACTIVE' || conv.status === 'COMPLETED') {
      const manageUrl = conv.userId ? await createLoginLink(conv.userId, { next: '/list' }).catch(() => null) : null
      await ctx.say(copy.editLive(manageUrl))
    } else {
      await ctx.say(copy.editNotPossible())
    }
    return conv
  }
  await ctx.persist({ status: 'REVIEW', currentQuestion: null })
  await ctx.say(copy.editReopened(check.status))
  return showReview(ctx)
}

// ── Continuing ─────────────────────────────────────────────────────────────

async function continueConversation(conv, msg, contactName) {
  const ctx = ctxFor(conv)
  conv.draft.fields ??= {}
  conv.draft.photos ??= []
  conv.draft.flags ??= {}

  const pending = conv.draft.pending

  // Identity first — nothing else is possible without an account.
  if (pending?.kind === 'link') return resolveLinkOffer(ctx, msg, contactName)

  // Global commands.
  if (isCmd(msg, 'cancel', 'stop', 'exit', 'quit') || isReply(msg, 'act:cancel')) {
    await conversations.cancel(conv)
    track(conv, 'wa_conversation_cancelled', { at: conv.status, question: conv.currentQuestion })
    await ctx.say(copy.cancelled())
    return conv
  }
  if (isCmd(msg, 'restart', 'start over', 'reset', 'start again')) {
    conv.draft.pending = { kind: 'restart' }
    await ctx.persist()
    await ctx.buttons(copy.confirmRestart(), [{ id: 'act:restart:yes', title: 'Yes, start over' }, { id: 'act:restart:no', title: 'No, continue' }])
    return conv
  }
  if (pending?.kind === 'restart') {
    conv.draft.pending = null
    if (isReply(msg, 'act:restart:yes') || isCmd(msg, 'yes', 'y')) {
      await conversations.cancel(conv)
      track(conv, 'wa_conversation_cancelled', { at: conv.status, restart: true })
      await ctx.say(copy.restarted())
      return startConversation(conv.phone, { kind: 'other' }, contactName)
    }
    await ctx.persist()
    return askCurrent(ctx)
  }
  if (isCmd(msg, 'help', '?', 'menu')) { await ctx.say(copy.help()); return conv }
  if (isCmd(msg, 'status', 'progress')) {
    if (!conv.propertyType) return askType(ctx)
    await ctx.say(copy.status(conv.propertyType, completion(conv.propertyType, conv.draft), missingRequired(conv.propertyType, conv.draft)))
    return conv
  }
  if (isCmd(msg, 'review', 'summary', 'show listing') && conv.propertyType && missingRequired(conv.propertyType, conv.draft).length === 0) {
    return showReview(ctx)
  }

  // A long silence: say hello before carrying on.
  if (conv.propertyType && Date.now() - new Date(conv.lastMessageAt).getTime() > RESUME_AFTER_MS && msg.kind === 'text' && GREETINGS.includes(norm(msg.text))) {
    await ctx.say(copy.resumed(conv.propertyType, completion(conv.propertyType, conv.draft)))
    return askCurrent(ctx)
  }

  // Media and locations, whatever the state.
  if (msg.kind === 'image') return onPhoto(ctx, msg)
  if (msg.kind === 'location') return onLocation(ctx, { kind: 'pin', lat: msg.lat, lng: msg.lng, name: msg.name, address: msg.address })
  if (msg.kind === 'text' && looksLikeMapsLink(msg.text)) return onLocation(ctx, { kind: 'link', text: msg.text })
  if (msg.kind === 'text' && coordsFromText(msg.text) && conv.status === 'LOCATION') return onLocation(ctx, { kind: 'text', text: msg.text })

  // Pending sub-flows.
  if (pending?.kind === 'broker') return resolveBrokerGate(ctx, msg)
  if (pending?.kind === 'location') return resolveLocationConfirm(ctx, msg)
  if (pending?.kind === 'pincode') return resolvePincode(ctx, msg)
  if (pending?.kind === 'business') return resolveBusinessGate(ctx, msg)
  if (pending?.kind === 'edit') return resolveEditChoice(ctx, msg)
  if (pending?.kind === 'editq') return resolveEditQuestion(ctx, msg)
  if (pending?.kind === 'email') return resolveEmail(ctx, msg)

  switch (conv.status) {
    case 'START':
    case 'PROPERTY_TYPE':
      return handleTypeSelection(ctx, msg)
    case 'QUESTIONNAIRE':
    case 'LOCATION':
    case 'PHOTOS':
      return handleAnswer(ctx, msg)
    case 'REVIEW':
    case 'CONFIRMATION':
      return handleReview(ctx, msg)
    default:
      return conv
  }
}

// ── Identity: the link offer ───────────────────────────────────────────────

async function resolveLinkOffer(ctx, msg, contactName) {
  const { conv } = ctx
  const pending = conv.draft.pending
  let user
  if (isReply(msg, 'act:link:yes') || isCmd(msg, 'yes', 'y', 'yes that\'s me', 'me')) {
    user = await identity.linkExistingAccount(pending.userId, conv.phone)
    await ctx.say(copy.linkedAccount())
  } else if (isReply(msg, 'act:link:no') || isCmd(msg, 'no', 'n', 'new account', 'new')) {
    user = await identity.createWhatsAppOwner(conv.phone, { name: contactName })
    await ctx.say(copy.startedFresh())
  } else {
    await ctx.buttons(copy.linkOffer('that account'), [
      { id: 'act:link:yes', title: "Yes, that's me" }, { id: 'act:link:no', title: 'No, new account' },
    ])
    return conv
  }
  conv.userId = user.id
  conv.draft.flags.name = user.name
  const first = pending.firstMessage
  conv.draft.pending = null
  await ctx.persist({ userId: user.id, status: 'PROPERTY_TYPE' })
  return handleTypeSelection(ctx, first?.kind === 'text' ? first : { kind: 'other' })
}

// ── Property type ──────────────────────────────────────────────────────────

async function askType(ctx) {
  await ctx.list(copy.askType(), copy.typeRows(), { buttonText: 'Choose type', sectionTitle: 'Property type' })
  await ctx.persist({ status: 'PROPERTY_TYPE' })
  return ctx.conv
}

async function handleTypeSelection(ctx, msg) {
  const { conv } = ctx

  // The broker gate — the flow's FIRST question, whatever identity path led
  // here (new account, verified owner, linked account: all three land in this
  // function). The message that arrived rides along in `pending` so a typed
  // "2bhk in Velachery, 28k rent" still counts once the gate is passed.
  if (!conv.draft.flags.brokerOk) {
    conv.draft.pending = { kind: 'broker', firstMessage: ['text', 'reply'].includes(msg.kind) ? msg : null }
    await ctx.persist()
    await ctx.buttons(copy.brokerGate(), BROKER_BUTTONS)
    return conv
  }

  // The email — asked at the START, right after the gate, whenever the account
  // has none (operator decision 2026-09-02; it was an optional ask at review).
  // The message that arrived rides along in `pending`, same as the gate, so a
  // typed description still counts once the email is in.
  if (!conv.draft.flags.emailAsked) {
    const user = await identity.getUser(conv.userId)
    if (user && !user.email) {
      conv.draft.flags.emailAsked = true
      conv.draft.pending = { kind: 'email', firstMessage: ['text', 'reply'].includes(msg.kind) ? msg : null }
      await ctx.persist()
      await ctx.say(copy.askEmail())
      return conv
    }
  }

  let category = null
  let extracted = null

  if (msg.kind === 'reply' && msg.id.startsWith('type:')) {
    category = msg.id.slice(5)
    if (!CATEGORY_KEYS.includes(category)) category = null
  } else if (msg.kind === 'text' && msg.text) {
    if (GREETINGS.includes(norm(msg.text))) return askType(ctx)
    extracted = { ...(await extractFields(msg.text, { category: null, draft: conv.draft })), rawText: msg.text }
    category = extracted.propertyType
    if (!category) {
      const byName = Object.entries(CATEGORIES).find(([k, c]) => norm(msg.text) === k || norm(msg.text) === norm(c.label))
      category = byName?.[0] ?? null
    }
  }

  if (!category) {
    if (msg.kind === 'text' && msg.text) await ctx.say(copy.didNotUnderstandType())
    return askType(ctx)
  }

  const user = await identity.getUser(conv.userId)
  if (CATEGORIES[category].tier === 'biz' && !user?.isBusiness) {
    conv.draft.pending = { kind: 'business', category, extracted: extracted ? { fields: extracted.fields, locationText: extracted.locationText, rawText: extracted.rawText } : null }
    await ctx.persist()
    await ctx.buttons(copy.businessGate(category), [{ id: 'act:biz:yes', title: 'Yes, continue' }, { id: 'act:biz:no', title: 'Choose another' }])
    return conv
  }
  return beginQuestionnaire(ctx, category, extracted)
}

const BROKER_BUTTONS = [
  { id: 'act:broker:no', title: "No — I'm the owner" },
  { id: 'act:broker:yes', title: "Yes, I'm a broker" },
]

async function resolveBrokerGate(ctx, msg) {
  const { conv } = ctx
  const pending = conv.draft.pending
  if (isReply(msg, 'act:broker:no') || isCmd(msg, 'no', 'n', 'owner', 'i am the owner', "i'm the owner", 'im the owner', 'no i am the owner', 'not a broker', 'nahi', 'illa')) {
    conv.draft.flags.brokerOk = true
    conv.draft.pending = null
    await ctx.persist()
    return handleTypeSelection(ctx, pending.firstMessage ?? { kind: 'other' })
  }
  if (isReply(msg, 'act:broker:yes') || isCmd(msg, 'yes', 'y', 'broker', 'i am a broker', "i'm a broker", 'im a broker', 'agent', 'yes i am a broker', 'haan')) {
    track(conv, 'wa_broker_rejected')
    await conversations.cancel(conv)
    await ctx.say(copy.brokerRejected())
    return conv
  }
  await ctx.buttons(copy.brokerGate(), BROKER_BUTTONS)
  return conv
}

async function resolveBusinessGate(ctx, msg) {
  const { conv } = ctx
  const pending = conv.draft.pending
  if (isReply(msg, 'act:biz:yes') || isCmd(msg, 'yes', 'y', 'continue', 'ok')) {
    const user = await identity.getUser(conv.userId)
    await identity.ensureBusiness(user)
    conv.draft.pending = null
    return beginQuestionnaire(ctx, pending.category, pending.extracted)
  }
  if (isReply(msg, 'act:biz:no') || isCmd(msg, 'no', 'n')) {
    conv.draft.pending = null
    return askType(ctx)
  }
  await ctx.buttons(copy.businessGate(pending.category), [{ id: 'act:biz:yes', title: 'Yes, continue' }, { id: 'act:biz:no', title: 'Choose another' }])
  return conv
}

async function beginQuestionnaire(ctx, category, extracted) {
  const { conv } = ctx
  conv.propertyType = category
  await ctx.persist({ propertyType: category, status: 'QUESTIONNAIRE' })
  track(conv, 'wa_type_selected')
  track(conv, 'wa_questionnaire_started')
  await ctx.say(copy.typeChosen(category))

  if (extracted?.rawText) {
    // Re-run through THIS category's questionnaire: the first pass had no
    // category, so it could not validate a value against the right question.
    const re = await extractFields(extracted.rawText, { category, draft: conv.draft }).catch(() => null)
    const apply = re?.fields ?? extracted.fields ?? {}
    if (Object.keys(apply).length) {
      applyFields(conv, category, apply)
      const summary = copy.capturedSummary(category, apply)
      if (summary) await ctx.say(summary)
    }
    if (re?.locationText) extracted.locationText = re.locationText
  }
  if (extracted?.locationText && !conv.draft.location?.confirmed) {
    await ctx.persist()
    return onLocation(ctx, { kind: 'text', text: extracted.locationText }, { thenAsk: true })
  }
  return askNext(ctx)
}

function applyFields(conv, category, values) {
  const f = fields(conv)
  for (const [field, value] of Object.entries(values)) {
    const q = (getQuestionnaire(category) ?? []).find((x) => x.field === field)
    if (!q || ['location', 'image'].includes(q.type)) continue
    f[field] = value
  }
}

// ── Asking ─────────────────────────────────────────────────────────────────

async function askCurrent(ctx) {
  const { conv } = ctx
  if (!conv.propertyType) return askType(ctx)
  const q = (conv.currentQuestion && findQuestion(conv.propertyType, conv.currentQuestion)) || nextQuestion(conv.propertyType, conv.draft)
  if (!q) return showReview(ctx)
  return askQuestion(ctx, q)
}

async function askNext(ctx, { after = null } = {}) {
  const { conv } = ctx
  const q = nextQuestion(conv.propertyType, conv.draft, { after })
  if (!q) return showReview(ctx)
  return askQuestion(ctx, q)
}

async function askQuestion(ctx, q) {
  const { conv } = ctx
  const status = q.type === 'location' ? 'LOCATION' : q.type === 'image' ? 'PHOTOS' : 'QUESTIONNAIRE'
  conv.currentQuestion = q.id
  await ctx.persist({ currentQuestion: q.id, status })

  const label = questionLabel(q, conv.draft)
  if (q.type === 'location') { await ctx.say(copy.askLocation(conv.propertyType)); return conv }
  if (q.type === 'image') {
    const n = conv.draft.photos.length
    const body = n ? `${copy.photoReceived(n)} Send more, or tap Done.` : copy.askPhotos(conv.propertyType)
    await ctx.buttons(body, [{ id: 'act:photos_done', title: 'Done' }])
    return conv
  }
  if (q.type === 'boolean') {
    const buttons = [{ id: `opt:${q.id}:0`, title: 'Yes' }, { id: `opt:${q.id}:1`, title: 'No' }]
    if (!q.required) buttons.push({ id: 'act:skip', title: 'Skip' })
    await ctx.buttons(label, buttons)
    return conv
  }
  if (q.type === 'single_select') {
    const opts = q.options ?? []
    if (opts.length <= 3 && q.required) {
      await ctx.buttons(label, opts.map((o, i) => ({ id: `opt:${q.id}:${i}`, title: o.label })))
    } else {
      const rows = opts.map((o, i) => ({ id: `opt:${q.id}:${i}`, title: o.label, description: o.description }))
      if (!q.required && rows.length < 10) rows.push({ id: 'act:skip', title: 'Skip' })
      await ctx.list(label, rows, { buttonText: 'Choose', sectionTitle: 'Options' })
    }
    return conv
  }
  if (q.type === 'multi_select') return sendMultiSelect(ctx, q, 0)
  await ctx.say(q.help ? `${label}\n_${q.help}_` : label)
  return conv
}

// ── Multi-select: a tap-to-toggle list ─────────────────────────────────────
//
// WhatsApp has no multi-select control, so the pattern is a list where each
// tap TOGGLES one option (the list is re-sent with ✓ marks) and a Done row
// finishes. Lists carry at most 10 rows, so options page 8 at a time with a
// More row that cycles. The page is derived from the tapped index — no page
// state survives in the draft, which keeps a stale tap harmless.
// Typing still works exactly as before ("wifi, ac" / "1, 3") and MERGES with
// whatever is already ticked; "none" clears.

const MSEL_PAGE = 8

async function sendMultiSelect(ctx, q, page = 0) {
  const { conv } = ctx
  const opts = q.options ?? []
  const current = fields(conv)[q.field]
  const selected = new Set(Array.isArray(current) ? current : [])
  const pages = Math.max(1, Math.ceil(opts.length / MSEL_PAGE))
  const p = ((page % pages) + pages) % pages
  const rows = opts.slice(p * MSEL_PAGE, (p + 1) * MSEL_PAGE).map((o, i) => ({
    id: `ms:${q.id}:${p * MSEL_PAGE + i}`,
    title: `${selected.has(o.value) ? '✓ ' : ''}${o.label}`.slice(0, 24),
  }))
  rows.push({ id: `ms:${q.id}:done`, title: '✅ Done' })
  if (pages > 1) rows.push({ id: `ms:${q.id}:more:${(p + 1) % pages}`, title: '➡ More options', description: `Page ${p + 1} of ${pages}` })
  const chosen = opts.filter((o) => selected.has(o.value)).map((o) => o.label)
  await ctx.list(copy.multiSelectBody(questionLabel(q, conv.draft), chosen), rows, { buttonText: 'Select', sectionTitle: 'Tap to add or remove' })
  return conv
}

async function onMultiSelectReply(ctx, msg) {
  const { conv } = ctx
  const m = msg.id.match(/^ms:([^:]+):(done|more:\d+|\d+)$/)
  if (!m) return null
  const q = findQuestion(conv.propertyType, m[1])
  if (!q || q.type !== 'multi_select') return askCurrent(ctx)
  if (m[2] === 'done') {
    // Done with nothing ticked is an answer too — "none of these".
    if (!(q.field in fields(conv))) fields(conv)[q.field] = []
    await ctx.persist()
    return askNext(ctx, { after: q.id })
  }
  if (m[2].startsWith('more:')) return sendMultiSelect(ctx, q, parseInt(m[2].slice(5), 10))
  const idx = parseInt(m[2], 10)
  const opt = q.options?.[idx]
  if (!opt) return askCurrent(ctx)
  const set = new Set(Array.isArray(fields(conv)[q.field]) ? fields(conv)[q.field] : [])
  if (set.has(opt.value)) set.delete(opt.value)
  else set.add(opt.value)
  fields(conv)[q.field] = (q.options ?? []).map((o) => o.value).filter((v) => set.has(v))
  await ctx.persist()
  return sendMultiSelect(ctx, q, Math.floor(idx / MSEL_PAGE))
}

// ── Answering ──────────────────────────────────────────────────────────────

async function handleAnswer(ctx, msg) {
  const { conv } = ctx
  const category = conv.propertyType
  const current = conv.currentQuestion ? findQuestion(category, conv.currentQuestion) : null

  if (msg.kind === 'reply') {
    if (msg.id === 'act:photos_done') return onPhotosDone(ctx)
    if (msg.id.startsWith('ms:')) {
      const handled = await onMultiSelectReply(ctx, msg)
      if (handled) return handled
    }
    if (msg.id === 'act:skip' && current && !current.required) {
      fields(conv)[current.field] = null
      await ctx.persist()
      return askNext(ctx, { after: current.id })
    }
    const m = msg.id.match(/^opt:([^:]+):(\d+)$/)
    if (m) {
      const q = findQuestion(category, m[1])
      const opt = q?.options?.[Number(m[2])]
      if (q && opt) {
        fields(conv)[q.field] = opt.value
        await ctx.persist()
        return askNext(ctx, { after: q.id })
      }
    }
    return askCurrent(ctx)
  }

  if (msg.kind !== 'text' || !msg.text) return askCurrent(ctx)
  const text = msg.text

  // Location-type question: a typed place is a text location.
  if (current?.type === 'location') return onLocation(ctx, { kind: 'text', text })
  if (current?.type === 'image') {
    if (isCmd(msg, 'done', 'finished', 'that\'s all', 'thats all', 'ok done')) return onPhotosDone(ctx)
    await ctx.say(copy.needPhotos())
    return conv
  }

  // 1. The current question, directly — a short reply is almost always that.
  const applied = {}
  let extracted = null
  const direct = current ? parseAnswer(current, text, fields(conv)) : { ok: false }
  const isShort = text.length <= 24 && !/\d.*\D.*\d/.test(text)
  if (current && direct.ok && (isShort || ['single_select', 'multi_select', 'boolean', 'date'].includes(current.type))) {
    let value = direct.value
    // A typed multi-select ADDS to what is already ticked on the tap list —
    // "gym" after tapping WiFi must not drop WiFi. "none"/"skip" still clears.
    if (current.type === 'multi_select' && Array.isArray(value) && value.length) {
      const prev = Array.isArray(fields(conv)[current.field]) ? fields(conv)[current.field] : []
      const set = new Set([...prev, ...value])
      value = (current.options ?? []).map((o) => o.value).filter((v) => set.has(v))
    }
    fields(conv)[current.field] = value
    applied[current.field] = value
  }

  // 2. Whatever else the sentence carries. Not for a time question: "7 am"
  // is never a description of the property, and the extractor would read the
  // 7 as money and answer with a clarification instead of the time parser's
  // own sentence.
  if ((!Object.keys(applied).length || !isShort) && !(current?.type === 'time' && isShort)) {
    extracted = await extractFields(text, { category, draft: conv.draft, currentQuestion: current })
    for (const [field, value] of Object.entries(extracted.fields)) {
      if (field in applied) continue
      fields(conv)[field] = value
      applied[field] = value
    }
    // The current question, answered in a sentence without a cue ("28k" to
    // "Monthly rent?") — the direct parse above already handled the short
    // form; here a sentence like "rent is 28k, deposit 1 lakh" was extracted.
    if (current && !(current.field in applied) && !['location', 'image', 'single_select', 'multi_select'].includes(current.type) && direct.ok) {
      fields(conv)[current.field] = direct.value
      applied[current.field] = direct.value
    }
  }

  if (!Object.keys(applied).length) {
    if (extracted?.locationText && !conv.draft.location?.confirmed) return onLocation(ctx, { kind: 'text', text: extracted.locationText })
    if (extracted?.uncertain?.length) await ctx.say(copy.clarify(extracted.uncertain))
    else if (current) await ctx.say(direct.error ?? copy.didNotUnderstand())
    else await ctx.say(copy.didNotUnderstand())
    track(conv, 'wa_extraction_failed', { question: current?.id ?? null })
    return current ? askQuestion(ctx, current) : askNext(ctx)
  }

  await ctx.persist()
  const summary = copy.capturedSummary(category, applied)
  if (summary && (Object.keys(applied).length > 1 || !isShort)) await ctx.say(summary)
  if (extracted?.uncertain?.length) await ctx.say(copy.clarify(extracted.uncertain))

  if (extracted?.locationText && !conv.draft.location?.confirmed && !conv.draft.pending) {
    return onLocation(ctx, { kind: 'text', text: extracted.locationText }, { thenAsk: true })
  }
  return askNext(ctx, { after: current?.id ?? null })
}

// ── Location ───────────────────────────────────────────────────────────────

async function onLocation(ctx, input) {
  const { conv } = ctx
  if (!conv.propertyType) { await ctx.say('Let me know what you are listing first.'); return askType(ctx) }

  const result = await resolveLocationInput(input)
  switch (result.status) {
    case 'candidate': {
      conv.draft.pending = { kind: 'location', candidate: result.candidate }
      await ctx.persist({ status: 'LOCATION' })
      await ctx.buttons(copy.locationCandidate(result.candidate), [{ id: 'act:loc:confirm', title: 'Confirm' }, { id: 'act:loc:change', title: 'Change' }])
      return conv
    }
    case 'imprecise':
      track(conv, 'wa_location_failed', { reason: 'imprecise', source: input.kind })
      await ctx.say(copy.locationImprecise(result.place))
      return conv
    case 'outside_india':
      track(conv, 'wa_location_failed', { reason: 'outside_india', source: input.kind })
      await ctx.say(copy.locationOutsideIndia())
      return conv
    case 'unsupported_city':
      track(conv, 'wa_location_failed', { reason: 'unsupported_city', source: input.kind })
      await ctx.say(copy.locationUnsupported(result.place))
      return conv
    default:
      track(conv, 'wa_location_failed', { reason: 'unresolved', source: input.kind })
      // A typed place that did not resolve while another question is in
      // flight is not worth derailing the flow for — only insist when the
      // location itself is the question.
      if (input.kind !== 'text' || conv.status === 'LOCATION') await ctx.say(copy.locationUnresolved())
      return conv
  }
}

async function resolveLocationConfirm(ctx, msg) {
  const { conv } = ctx
  const candidate = conv.draft.pending.candidate
  if (isReply(msg, 'act:loc:confirm') || isCmd(msg, 'confirm', 'yes', 'y', 'correct', 'ok', 'okay')) {
    conv.draft.location = { ...candidate, confirmed: true }
    conv.draft.pending = null
    await ctx.persist()
    track(conv, 'wa_location_submitted', { source: candidate.source, precision: candidate.precision })
    await ctx.say(copy.locationConfirmed(candidate))
    if (conv.userId) identity.getUser(conv.userId).then((u) => u && identity.fillCityIfEmpty(u, candidate.city)).catch(() => {})
    if (!candidate.pincode) {
      conv.draft.pending = { kind: 'pincode' }
      await ctx.persist()
      await ctx.say(copy.askPincode())
      return conv
    }
    return askNext(ctx, { after: 'location' })
  }
  if (isReply(msg, 'act:loc:change') || isCmd(msg, 'change', 'no', 'n', 'wrong')) {
    conv.draft.pending = null
    await ctx.persist()
    await ctx.say(copy.locationChange())
    return conv
  }
  // Anything else while a pin is awaiting confirmation: a new link or a
  // typed place replaces the candidate; other text re-asks.
  if (msg.kind === 'text' && (looksLikeMapsLink(msg.text) || coordsFromText(msg.text))) {
    conv.draft.pending = null
    return onLocation(ctx, { kind: looksLikeMapsLink(msg.text) ? 'link' : 'text', text: msg.text })
  }
  await ctx.buttons(copy.locationCandidate(candidate), [{ id: 'act:loc:confirm', title: 'Confirm' }, { id: 'act:loc:change', title: 'Change' }])
  return conv
}

// ── Email (required, at the start) ─────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// The one way past the question without an address: the one they typed is on
// another account (`pending.allowSkip`, set only after a 'taken'). Anything
// else re-asks — the ask is required, and a wrong reply must not advance.
async function resolveEmail(ctx, msg) {
  const { conv } = ctx
  const pending = conv.draft.pending
  const proceed = async () => {
    conv.draft.pending = null
    await ctx.persist()
    return handleTypeSelection(ctx, pending.firstMessage ?? { kind: 'other' })
  }
  if (pending.allowSkip && (isReply(msg, 'act:skip') || isCmd(msg, 'skip', 'later', 'not now', 'no thanks'))) return proceed()
  const text = msg.kind === 'text' ? msg.text.trim() : ''
  if (!EMAIL_RE.test(text)) {
    await ctx.say(copy.emailInvalid())
    return conv
  }
  const outcome = await identity.setEmailIfEmpty(conv.userId, text)
  if (outcome === 'taken') {
    pending.allowSkip = true
    await ctx.persist()
    await ctx.say(copy.emailTaken())
    return conv
  }
  if (outcome === 'saved') await ctx.say(copy.emailSaved(text.toLowerCase()))
  return proceed()
}

async function resolvePincode(ctx, msg) {
  const { conv } = ctx
  const digits = msg.kind === 'text' ? msg.text.replace(/\D/g, '') : ''
  if (!/^\d{6}$/.test(digits)) { await ctx.say(copy.askPincode()); return conv }
  conv.draft.location.pincode = digits
  conv.draft.pending = null
  await ctx.persist()
  return askNext(ctx, { after: 'location' })
}

// ── Photos ─────────────────────────────────────────────────────────────────

async function onPhoto(ctx, msg) {
  const { conv } = ctx
  if (!conv.userId) return conv
  const result = await ingestPhoto(conv.draft, msg.media, conv.userId)
  switch (result.status) {
    case 'added':
      conv.draft.photos.push(result.photo)
      conv.draft.photosDone = false
      await ctx.persist()
      if (conv.status === 'PHOTOS') {
        await ctx.buttons(`${copy.photoReceived(conv.draft.photos.length)} Send more, or tap Done.`, [{ id: 'act:photos_done', title: 'Done' }])
      } else {
        await ctx.say(copy.photoReceived(conv.draft.photos.length))
      }
      return conv
    case 'duplicate': await ctx.say(copy.photoDuplicate()); return conv
    case 'full': await ctx.buttons(copy.photosFull(MAX_PHOTOS), [{ id: 'act:photos_done', title: 'Done' }]); return conv
    case 'invalid':
      track(conv, 'wa_photo_failed', { reason: 'invalid' })
      await ctx.say(copy.photoInvalid()); return conv
    default:
      track(conv, 'wa_photo_failed', { reason: 'download_or_upload' })
      await ctx.persist({ lastError: `photo: ${result.reason}` })
      await ctx.say(copy.photoFailed()); return conv
  }
}

async function onPhotosDone(ctx) {
  const { conv } = ctx
  if (!conv.draft.photos.length) { await ctx.say(copy.needPhotos()); return conv }
  conv.draft.photosDone = true
  await ctx.persist()
  track(conv, 'wa_photos_submitted', { count: conv.draft.photos.length })
  return askNext(ctx, { after: 'photos' })
}

// ── Review & publish ───────────────────────────────────────────────────────

async function showReview(ctx) {
  const { conv } = ctx
  const missing = missingRequired(conv.propertyType, conv.draft)
  if (missing.length) {
    await ctx.say(copy.stillNeed(missing))
    return askQuestion(ctx, missing[0])
  }
  if (!conv.draft.flags.draftCompleted) {
    conv.draft.flags.draftCompleted = true
    track(conv, 'wa_draft_completed')
  }
  const user = await identity.getUser(conv.userId)
  const showExact = user?.showExactLocation !== false
  await ctx.persist({ status: 'REVIEW', currentQuestion: null })
  track(conv, 'wa_review_shown')
  await ctx.buttons(copy.reviewSummary(conv.propertyType, conv.draft, { showExactLocation: showExact }), [
    { id: 'act:publish', title: 'Publish' }, { id: 'act:edit', title: 'Edit' }, { id: 'act:cancel', title: 'Cancel' },
  ])
  return conv
}

async function handleReview(ctx, msg) {
  const { conv } = ctx
  if (isReply(msg, 'act:publish') || isCmd(msg, 'publish', 'yes', 'y', 'go', 'confirm', 'ok')) return doPublish(ctx)
  if (isReply(msg, 'act:edit') || isCmd(msg, 'edit', 'change')) {
    conv.draft.pending = { kind: 'edit' }
    await ctx.persist()
    await ctx.list(copy.askWhatToEdit(), copy.editSections(), { buttonText: 'Choose section', sectionTitle: 'Sections' })
    return conv
  }
  if (isCmd(msg, 'approximate', 'approx', 'hide', 'blur') || isCmd(msg, 'exact', 'show exact', 'precise')) {
    const exact = isCmd(msg, 'exact', 'show exact', 'precise')
    await identity.setShowExactLocation(conv.userId, exact)
    await ctx.say(copy.privacySet(exact))
    return showReview(ctx)
  }
  if (msg.kind === 'text' && msg.text) {
    // A correction typed at the review: "rent is 30k" — apply it and re-show.
    const extracted = await extractFields(msg.text, { category: conv.propertyType, draft: conv.draft })
    if (extracted.applied.length) {
      applyFields(conv, conv.propertyType, extracted.fields)
      await ctx.persist()
      const summary = copy.capturedSummary(conv.propertyType, extracted.fields)
      if (summary) await ctx.say(summary)
      return showReview(ctx)
    }
  }
  return showReview(ctx)
}

async function resolveEditChoice(ctx, msg) {
  const { conv } = ctx
  const id = msg.kind === 'reply' && msg.id.startsWith('edit:') ? msg.id.slice(5)
    : msg.kind === 'text' ? Object.keys(SECTIONS).find((k) => norm(SECTIONS[k]) === norm(msg.text) || k === norm(msg.text)) : null
  if (!id || !SECTIONS[id]) {
    await ctx.list(copy.askWhatToEdit(), copy.editSections(), { buttonText: 'Choose section', sectionTitle: 'Sections' })
    return conv
  }
  await ctx.say(copy.editingSection(id))
  if (id === 'location') {
    conv.draft.pending = null
    conv.draft.location = null
    await ctx.persist({ status: 'QUESTIONNAIRE' })
    return askNext(ctx)
  }
  if (id === 'photos') {
    conv.draft.pending = null
    conv.draft.photosDone = false
    await ctx.persist({ status: 'QUESTIONNAIRE' })
    return askNext(ctx)
  }
  // A section is never wiped any more. That used to delete every answer in it
  // and re-ask the lot — "I want to add one amenity" cost an owner the whole
  // details questionnaire again. Now they pick the ONE question to change;
  // everything else keeps its answer, and because the draft stays complete,
  // answering it lands straight back at the review.
  const qs = editableQuestions(conv, id)
  if (qs.length === 1) {
    conv.draft.pending = null
    await ctx.persist({ status: 'QUESTIONNAIRE' })
    return askQuestion(ctx, qs[0])
  }
  return sendEditQuestionList(ctx, id, 0)
}

function editableQuestions(conv, section) {
  return questionsInSection(conv.propertyType, section)
    .filter((q) => isVisible(q, conv.draft) && !['location', 'image'].includes(q.type))
}

// Lists carry at most 10 rows: 9 questions + a More row that cycles, same
// pattern as the multi-select pager. Each row shows the CURRENT answer, so
// the owner can see what needs changing without opening anything.
const EDITQ_PAGE = 9

async function sendEditQuestionList(ctx, section, page = 0) {
  const { conv } = ctx
  const qs = editableQuestions(conv, section)
  const pages = Math.max(1, Math.ceil(qs.length / EDITQ_PAGE))
  const p = ((page % pages) + pages) % pages
  const rows = qs.slice(p * EDITQ_PAGE, (p + 1) * EDITQ_PAGE).map((q) => ({
    id: `eq:${q.id}`,
    title: copy.shortLabel(q).slice(0, 24),
    description: copy.currentAnswer(conv.propertyType, q, conv.draft),
  }))
  if (pages > 1) rows.push({ id: `eq:more:${section}:${(p + 1) % pages}`, title: '➡ More', description: `Page ${p + 1} of ${pages}` })
  conv.draft.pending = { kind: 'editq', section }
  await ctx.persist()
  await ctx.list(copy.askWhatToChange(SECTIONS[section]), rows, { buttonText: 'Choose', sectionTitle: 'Tap one to change' })
  return conv
}

async function resolveEditQuestion(ctx, msg) {
  const { conv } = ctx
  const section = conv.draft.pending.section
  const open = async (q) => {
    conv.draft.pending = null
    await ctx.persist({ status: 'QUESTIONNAIRE' })
    return askQuestion(ctx, q)
  }
  if (msg.kind === 'reply') {
    const more = msg.id.match(/^eq:more:([^:]+):(\d+)$/)
    if (more) return sendEditQuestionList(ctx, more[1], parseInt(more[2], 10))
    const m = msg.id.match(/^eq:([^:]+)$/)
    const q = m && findQuestion(conv.propertyType, m[1])
    if (q) return open(q)
  }
  if (msg.kind === 'text') {
    const hit = editableQuestions(conv, section).find((q) => norm(copy.shortLabel(q)) === norm(msg.text) || q.id === norm(msg.text))
    if (hit) return open(hit)
  }
  return sendEditQuestionList(ctx, section, 0)
}

async function doPublish(ctx) {
  const { conv } = ctx
  await ctx.persist({ status: 'CONFIRMATION' })
  track(conv, 'wa_publish_confirmed')

  const result = await publishFromConversation(conv)
  if (result.ok) {
    conv.propertyId = result.property.id
    await ctx.persist({ status: 'VERIFICATION', propertyId: result.property.id, lastError: null })
    await ctx.say(result.updated ? copy.resubmitted(conv.propertyType) : copy.submitted(conv.propertyType))
    intelLog('whatsapp.submitted', { conversationId: conv.id, propertyId: result.property.id, updated: !!result.updated })
    return conv
  }
  if (result.kind === 'validation') {
    track(conv, 'wa_publish_failed', { kind: 'validation' })
    await ctx.say(copy.publishFailedValidation(result.problems))
    for (const qid of result.reask) {
      const q = findQuestion(conv.propertyType, qid)
      if (!q) continue
      if (q.type === 'location') conv.draft.location = null
      else if (q.type === 'image') conv.draft.photosDone = false
      else delete fields(conv)[q.field]
    }
    await ctx.persist({ status: 'QUESTIONNAIRE' })
    return askNext(ctx)
  }
  track(conv, 'wa_publish_failed', { kind: 'error' })
  await ctx.persist({ status: 'REVIEW', lastError: `publish: ${result.error}` })
  await ctx.say(copy.publishFailedServer())
  return conv
}

/** Admin "retry publish" — the same path the Publish button takes. */
export async function retryPublish(conversationId) {
  const conv = await conversations.byId(conversationId)
  if (!conv || !['REVIEW', 'CONFIRMATION'].includes(conv.status)) throw Object.assign(new Error('Conversation is not awaiting publish'), { statusCode: 409 })
  conv.draft.fields ??= {}; conv.draft.photos ??= []; conv.draft.flags ??= {}
  const ctx = ctxFor(conv)
  return doPublish(ctx)
}

/** Admin "nudge" — re-ask whatever the conversation is waiting on. */
export async function nudge(conversationId) {
  const conv = await conversations.byId(conversationId)
  if (!conv || !conversations.OPEN_STATUSES.includes(conv.status)) throw Object.assign(new Error('Conversation is not open'), { statusCode: 409 })
  conv.draft.fields ??= {}; conv.draft.photos ??= []; conv.draft.flags ??= {}
  return askCurrent(ctxFor(conv))
}
