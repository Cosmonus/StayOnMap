// Mailer — one interface (`sendMail`), two delivery paths behind MAIL_PROVIDER.
//
//   smtp  (default) — nodemailer to any SMTP endpoint: a Gmail app password
//                     today, a self-hosted server later. Works locally.
//   brevo           — Brevo's transactional REST API over plain fetch (no SDK,
//                     no new dependency).
//
// Why the second path exists: Railway blocks outbound SMTP ports
// (25/465/587/2525) on every plan below Pro, so SMTP there fails no matter how
// it's configured — an HTTPS API is the only way to send. Nothing else in the
// app knows or cares which path is active.
//
// A daily send counter (Redis when available, in-memory otherwise) enforces the
// provider's quota, and the last CRITICAL_RESERVE sends of each day are held
// back for critical emails (password resets, login codes) so routine
// notifications can never starve them. With no provider configured, sending is
// a logged no-op — same behavior the app had before email was set up.
import nodemailer from 'nodemailer'
import { redis } from './redis.js'
import { env } from '../config/env.js'

const CRITICAL_RESERVE = 10

// A blocked or black-holed SMTP port would otherwise hang on nodemailer's
// 2-minute default. Login codes are sent on the request path, so a caller
// waiting two minutes for a failure is itself the outage.
const SMTP_TIMEOUT_MS = 10_000
const HTTP_TIMEOUT_MS = 10_000

// Pure quota decision (exported for tests): is there room for this send?
export function hasQuota(used, cap, critical) {
  const remaining = cap - used
  if (remaining <= 0) return false
  if (!critical && remaining <= CRITICAL_RESERVE) return false
  return true
}

// "StayOnMap <no-reply@x.com>" → { name: 'StayOnMap', email: 'no-reply@x.com' }
// SMTP takes the raw string; Brevo's API needs the parts split out.
export function parseFrom(from) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from)
  if (match) return { name: match[1] || undefined, email: match[2] }
  return { email: from.trim() }
}

function log(event, data) {
  if (env.nodeEnv === 'test') return
  console.log(JSON.stringify({ src: 'mail', event, ...data }))
}

// ── Daily counter — Redis-backed (shared across instances), memory fallback ─
const memCounts = new Map()

function quotaKey() {
  return `mail:sent:${new Date().toISOString().slice(0, 10)}`
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

// ── Delivery: SMTP ──────────────────────────────────────────────────────────
let transport = null

function getTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null
  transport ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })
  return transport
}

async function deliverViaSmtp({ to, subject, html }) {
  await getTransport().sendMail({ from: env.mailFrom, to, subject, html })
}

// ── Delivery: Brevo REST API ────────────────────────────────────────────────
async function deliverViaBrevo({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.brevoApiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseFrom(env.mailFrom),
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  if (!res.ok) {
    // Body carries Brevo's reason (unverified sender, bad key, quota) — worth
    // surfacing, but truncated so a huge error page can't flood the logs.
    const detail = await res.text().catch(() => '')
    throw new Error(`brevo ${res.status}: ${detail.slice(0, 200)}`)
  }
}

// ── Provider selection ──────────────────────────────────────────────────────
function isBrevo() {
  return env.mailProvider === 'brevo'
}

// Is a sender configured at all? (Not "will it succeed" — that needs a send.)
function senderReady() {
  return isBrevo() ? !!env.brevoApiKey : !!getTransport()
}

// Pre-flight: would a send of this kind go out right now? Lets a caller bail
// BEFORE doing any account-specific work — OTP login uses this so a
// quota-exhausted response is identical for registered and unregistered
// emails, which would otherwise be an account-enumeration oracle (an
// existing address 503s on a failed send while an unknown one 200s).
export async function canSend(critical = false) {
  if (!senderReady()) return false
  return hasQuota(await getUsed(), env.mailDailyCap, critical)
}

// ── Entry point — never throws; returns whether the email actually went out ─
export async function sendMail({ to, subject, html, critical = false }) {
  const provider = isBrevo() ? 'brevo' : 'smtp'

  if (!senderReady()) {
    log('dropped', { provider, critical, reason: 'mail provider not configured' })
    return false
  }

  const used = await getUsed()
  if (!hasQuota(used, env.mailDailyCap, critical)) {
    log('dropped', { provider, critical, used, cap: env.mailDailyCap, reason: 'daily quota exhausted' })
    return false
  }

  const startedAt = Date.now()
  try {
    await (isBrevo() ? deliverViaBrevo({ to, subject, html }) : deliverViaSmtp({ to, subject, html }))
    await markUsed()
    log('sent', { provider, critical, used: used + 1, cap: env.mailDailyCap, ms: Date.now() - startedAt })
    return true
  } catch (err) {
    log('send_failed', { provider, critical, error: err.message, ms: Date.now() - startedAt })
    return false
  }
}
