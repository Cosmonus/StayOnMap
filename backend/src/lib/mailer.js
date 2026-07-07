// Vendor-free mailer — plain SMTP (nodemailer), no third-party email APIs.
//
// Point it at any SMTP endpoint via env (SMTP_HOST/PORT/USER/PASS): a Gmail
// account with an app password today, a self-hosted mail server later — the
// code doesn't care. A daily send counter (Redis when available, in-memory
// otherwise) enforces the endpoint's quota, and the last CRITICAL_RESERVE
// sends of each day are held back for critical emails (password resets,
// security alerts) so routine notification emails can never starve them.
// With no SMTP configured, sending is a logged no-op — same behavior the
// app had before email was set up.
import nodemailer from 'nodemailer'
import { redis } from './redis.js'
import { env } from '../config/env.js'

const CRITICAL_RESERVE = 10

// Pure quota decision (exported for tests): is there room for this send?
export function hasQuota(used, cap, critical) {
  const remaining = cap - used
  if (remaining <= 0) return false
  if (!critical && remaining <= CRITICAL_RESERVE) return false
  return true
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

let transport = null

function getTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null
  transport ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  })
  return transport
}

// ── Entry point — never throws; returns whether the email actually went out ─
export async function sendMail({ to, subject, html, critical = false }) {
  const smtp = getTransport()
  if (!smtp) {
    log('dropped', { critical, reason: 'smtp not configured' })
    return false
  }

  const used = await getUsed()
  if (!hasQuota(used, env.smtpDailyCap, critical)) {
    log('dropped', { critical, used, cap: env.smtpDailyCap, reason: 'daily quota exhausted' })
    return false
  }

  const startedAt = Date.now()
  try {
    await smtp.sendMail({ from: env.mailFrom, to, subject, html })
    await markUsed()
    log('sent', { critical, used: used + 1, cap: env.smtpDailyCap, ms: Date.now() - startedAt })
    return true
  } catch (err) {
    log('send_failed', { critical, error: err.message })
    return false
  }
}
