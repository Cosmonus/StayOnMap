// Mailer — one interface (`sendMail`), four delivery paths behind MAIL_PROVIDER.
//
//   smtp      (default) — nodemailer to any SMTP endpoint: a Gmail app
//                         password today, a self-hosted server later. Works
//                         locally.
//   zeptomail           — Zoho ZeptoMail's transactional REST API over plain
//                         fetch (no SDK, no new dependency). The production
//                         path (2026-07-21 decision).
//   resend / brevo      — same shape, kept as alternatives.
//
// Why the HTTPS paths exist: Railway blocks outbound SMTP ports
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

// ── Delivery: Resend REST API ───────────────────────────────────────────────
async function deliverViaResend({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.resendApiKey}`,
      'content-type': 'application/json',
    },
    // Unlike Brevo, Resend takes `from` as the raw "Name <email>" string.
    body: JSON.stringify({ from: env.mailFrom, to: [to], subject, html }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  if (!res.ok) {
    // Body carries Resend's reason (unverified domain, bad key, rate limit) —
    // worth surfacing, but truncated so a huge error page can't flood the logs.
    const detail = await res.text().catch(() => '')
    throw new Error(`resend ${res.status}: ${detail.slice(0, 200)}`)
  }
}

// ── Delivery: Zoho ZeptoMail REST API ───────────────────────────────────────
async function deliverViaZeptomail({ to, subject, html }) {
  const from = parseFrom(env.mailFrom)
  const res = await fetch(env.zeptomailApiUrl, {
    method: 'POST',
    headers: {
      authorization: `Zoho-enczapikey ${env.zeptomailToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: { address: from.email, name: from.name },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  if (!res.ok) {
    // Body carries ZeptoMail's reason (unverified domain, bad token, blocked
    // content) — worth surfacing, but truncated so it can't flood the logs.
    const detail = await res.text().catch(() => '')
    throw new Error(`zeptomail ${res.status}: ${detail.slice(0, 200)}`)
  }
}

// ── Provider selection ──────────────────────────────────────────────────────
function provider() {
  if (env.mailProvider === 'zeptomail') return 'zeptomail'
  if (env.mailProvider === 'resend') return 'resend'
  if (env.mailProvider === 'brevo') return 'brevo'
  return 'smtp'
}

// Is a sender configured at all? (Not "will it succeed" — that needs a send.)
function senderReady() {
  switch (provider()) {
    case 'zeptomail': return !!env.zeptomailToken
    case 'resend': return !!env.resendApiKey
    case 'brevo': return !!env.brevoApiKey
    default: return !!getTransport()
  }
}

const DELIVER = { zeptomail: deliverViaZeptomail, resend: deliverViaResend, brevo: deliverViaBrevo, smtp: deliverViaSmtp }

// Dev-only console delivery: with NO provider configured in development, an
// email "sends" by printing to the server console — so OTP login and reset
// links are testable on a fresh checkout with zero mail credentials (the
// letter-opener pattern). Never in production: there a missing provider must
// stay a loud drop, not a silent console success nobody reads.
function devEcho() {
  return env.nodeEnv === 'development' && !senderReady()
}

// Pre-flight: would a send of this kind go out right now? Lets a caller bail
// BEFORE doing any account-specific work — OTP login uses this so a
// quota-exhausted response is identical for registered and unregistered
// emails, which would otherwise be an account-enumeration oracle (an
// existing address 503s on a failed send while an unknown one 200s).
export async function canSend(critical = false) {
  if (devEcho()) return true
  if (!senderReady()) return false
  return hasQuota(await getUsed(), env.mailDailyCap, critical)
}

// ── Entry point — never throws; returns whether the email actually went out ─
export async function sendMail({ to, subject, html, critical = false }) {
  const active = provider()

  if (devEcho()) {
    // Text content only — an OTP code or reset link lives in the body, and
    // reading it off the console IS the delivery.
    console.log(`\n[mail dev-echo] To: ${to}\n[mail dev-echo] Subject: ${subject}\n[mail dev-echo] ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`)
    return true
  }

  if (!senderReady()) {
    log('dropped', { provider: active, critical, reason: 'mail provider not configured' })
    return false
  }

  const used = await getUsed()
  if (!hasQuota(used, env.mailDailyCap, critical)) {
    log('dropped', { provider: active, critical, used, cap: env.mailDailyCap, reason: 'daily quota exhausted' })
    return false
  }

  const startedAt = Date.now()
  try {
    await DELIVER[active]({ to, subject, html })
    await markUsed()
    log('sent', { provider: active, critical, used: used + 1, cap: env.mailDailyCap, ms: Date.now() - startedAt })
    return true
  } catch (err) {
    log('send_failed', { provider: active, critical, error: err.message, ms: Date.now() - startedAt })
    return false
  }
}
