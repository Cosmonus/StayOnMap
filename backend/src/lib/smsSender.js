// SMS sender — one interface (`sendSms`), three delivery paths behind SMS_PROVIDER.
//
//   msg91     — MSG91's OTP-flow API. The mainstream Indian transactional
//               provider; DLT template registration is done in their console.
//   fast2sms  — cheaper, simpler API. Same shape.
//   (unset)   — in development, an SMS "sends" by printing to the server
//               console, so the whole verification flow is testable on a fresh
//               checkout with zero credentials. In production an unset provider
//               is a loud drop, never a silent console success nobody reads.
//
// Deliberately a near-copy of lib/mailer.js rather than a shared abstraction:
// the two have different quotas, different failure meanings and different
// providers, and one "notification sender" covering both would be an
// abstraction over a coincidence.
//
// What is NOT copied, on purpose: mailer's CRITICAL_RESERVE. Email is shared
// across notifications, resets and login codes, so routine mail has to be held
// back from starving a reset. Every SMS this app sends is a verification code —
// there is no routine tier to reserve against.
//
// ⚠ Cost, named out loud: SMS is the only metered thing in this flow. Indian
// transactional SMS runs roughly ₹0.15-0.25 per message, and sending it at all
// requires TRAI DLT registration (entity + template approval, done once by the
// operator in the provider's console). There is no free path — which is why
// nothing here assumes a provider exists.
import { redis } from './redis.js'
import { env } from '../config/env.js'
import { sendTemplate, whatsappConfigured } from '../features/whatsapp/client.js'

const HTTP_TIMEOUT_MS = 10_000

function log(event, data) {
  if (env.nodeEnv === 'test') return
  console.log(JSON.stringify({ src: 'sms', event, ...data }))
}

// ── Daily counter — Redis-backed (shared across instances), memory fallback ─
const memCounts = new Map()

function quotaKey() {
  return `sms:sent:${new Date().toISOString().slice(0, 10)}`
}

async function getUsed() {
  const key = quotaKey()
  if (redis) {
    try { return Number(await redis.get(key)) || 0 } catch { /* fall through */ }
  }
  return memCounts.get(key) ?? 0
}

async function markUsed() {
  const key = quotaKey()
  if (redis) {
    try {
      await redis.incr(key)
      await redis.expire(key, 2 * 24 * 60 * 60)
      return
    } catch { /* fall through */ }
  }
  const count = memCounts.get(key) ?? 0
  memCounts.clear() // only today's key matters — yesterday's count is dead weight
  memCounts.set(key, count + 1)
}

// ── Delivery: MSG91 ─────────────────────────────────────────────────────────
// MSG91 sends the code itself from a DLT-approved template, so the message
// TEXT lives in their console, not here — we hand over the number and the
// value that fills the template's ##OTP## variable.
async function deliverViaMsg91({ phone, code }) {
  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: env.msg91AuthKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      template_id: env.msg91TemplateId,
      mobile: `91${phone}`,
      otp: code,
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const body = await res.json().catch(() => null)
  // MSG91 answers 200 with {type:'error'} for a bad template or unapproved
  // sender, so the status code alone is not the success signal.
  if (!res.ok || body?.type === 'error') {
    throw new Error(`msg91 ${res.status}: ${String(body?.message ?? '').slice(0, 200)}`)
  }
}

// ── Delivery: Fast2SMS ──────────────────────────────────────────────────────
async function deliverViaFast2sms({ phone, code }) {
  const url = new URL('https://www.fast2sms.com/dev/bulkV2')
  url.searchParams.set('route', 'otp')
  url.searchParams.set('variables_values', code)
  url.searchParams.set('numbers', phone)

  const res = await fetch(url, {
    headers: { authorization: env.fast2smsApiKey },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.return === false) {
    throw new Error(`fast2sms ${res.status}: ${String(body?.message ?? '').slice(0, 200)}`)
  }
}

// ── Delivery: WhatsApp ──────────────────────────────────────────────────────
// The code goes out as an AUTHENTICATION-category template through the same
// Cloud API the listing bot uses. Meta's authentication templates carry the
// code as the body's {{1}} and, optionally, a copy-code button whose payload is
// the same value — both are filled here. No DLT registration; cheaper than
// SMS in India; still metered per conversation, which is why the daily cap
// applies to this path exactly as it does to the others.
async function deliverViaWhatsApp({ phone, code }) {
  const id = await sendTemplate(`91${phone}`, { name: env.whatsapp.otpTemplate, params: [code], buttonUrlParam: code })
  if (!id) throw new Error('whatsapp: template send refused')
}

// ── Provider selection ──────────────────────────────────────────────────────
function provider() {
  if (env.smsProvider === 'fast2sms') return 'fast2sms'
  if (env.smsProvider === 'whatsapp') return 'whatsapp'
  return 'msg91'
}

// Is a sender configured at all? (Not "will it succeed" — that needs a send.)
function senderReady() {
  switch (provider()) {
    case 'fast2sms': return !!env.fast2smsApiKey
    case 'whatsapp': return whatsappConfigured() && !!env.whatsapp.otpTemplate
    // MSG91 needs both halves: an auth key with no approved template id sends
    // nothing, and fails at their end rather than ours.
    default: return !!(env.msg91AuthKey && env.msg91TemplateId)
  }
}

const DELIVER = { msg91: deliverViaMsg91, fast2sms: deliverViaFast2sms, whatsapp: deliverViaWhatsApp }

function devEcho() {
  return env.nodeEnv === 'development' && !senderReady()
}

/**
 * Can this deployment verify a phone number at all? Synchronous and env-only,
 * so callers can gate UI on it without a round trip. The UI hides the Verify
 * affordance when this is false — the same "no dead buttons" rule the OAuth
 * providers endpoint follows, and the reason points can advertise
 * PHONE_VERIFIED as earnable only where it is actually earnable.
 */
export function smsConfigured() {
  return devEcho() || senderReady()
}

// Admin System Monitor readout — which path is live and how much of today's
// allowance is spent. Read-only; never triggers a send.
export async function smsStatus() {
  return {
    provider: devEcho() ? 'dev-echo' : provider(),
    configured: smsConfigured(),
    usedToday: await getUsed(),
    dailyCap: env.smsDailyCap,
  }
}

/** Pre-flight: would a send go out right now? Lets a caller bail before
 *  issuing a code it has no way to deliver. */
export async function canSendSms() {
  if (devEcho()) return true
  if (!senderReady()) return false
  return (await getUsed()) < env.smsDailyCap
}

// ── Entry point — never throws; returns whether the SMS actually went out ───
export async function sendSms({ phone, code }) {
  const active = provider()

  if (devEcho()) {
    // Reading the code off the console IS the delivery in development.
    console.log(`\n[sms dev-echo] To: +91${phone}\n[sms dev-echo] StayOnMap verification code: ${code}\n`)
    return true
  }

  if (!senderReady()) {
    log('dropped', { provider: active, reason: 'sms provider not configured' })
    return false
  }

  const used = await getUsed()
  if (used >= env.smsDailyCap) {
    log('dropped', { provider: active, used, cap: env.smsDailyCap, reason: 'daily quota exhausted' })
    return false
  }

  const startedAt = Date.now()
  try {
    await DELIVER[active]({ phone, code })
    await markUsed()
    // The code itself is never logged — a log line is a copy of the secret.
    log('sent', { provider: active, used: used + 1, cap: env.smsDailyCap, ms: Date.now() - startedAt })
    return true
  } catch (err) {
    log('send_failed', { provider: active, error: err.message, ms: Date.now() - startedAt })
    return false
  }
}
