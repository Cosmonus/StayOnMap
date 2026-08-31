// The WhatsApp Cloud API, wrapped once.
//
// Everything the listing bot says goes out through here, and every outbound
// message is recorded as a WhatsAppMessage row BEFORE the HTTP call so the
// admin transcript shows what we tried to say even when Meta refused it.
//
// Three rules, each a lesson from the mailer and SMS senders this mirrors:
//   1. NEVER throws on a send. Returns the Meta message id or null; the engine
//      decides what a failed send means for the conversation.
//   2. NEVER logs a body, a token or a full phone number. Logs carry the masked
//      number, the message kind and the outcome.
//   3. Dev with nothing configured is "dev-echo": the message is printed to the
//      server console and a fake id returned, so the whole flow runs on a fresh
//      checkout with zero credentials — the same shape smsSender.js has.
//
// Interactive message limits (Meta's, enforced here so no caller has to know):
//   buttons ≤ 3, button title ≤ 20 chars
//   list rows ≤ 10 per message, row title ≤ 24, row description ≤ 72
//   body text ≤ 1024 chars for interactive, 4096 for text
import crypto from 'crypto'
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { toMasked } from './phone.js'

const GRAPH = 'https://graph.facebook.com'
const HTTP_TIMEOUT_MS = 15_000
const MEDIA_TIMEOUT_MS = 30_000
// Meta's own cap on an image message is 5MB; our uploader's multer cap is 5MB
// too, so anything larger would be refused downstream anyway.
const MAX_MEDIA_BYTES = 5 * 1024 * 1024

function log(event, data) {
  if (env.nodeEnv === 'test') return
  console.log(JSON.stringify({ ts: new Date().toISOString(), src: 'whatsapp', event, ...data }))
}

/** Is the Cloud API wired up? All five values, or none of it works. */
export function whatsappConfigured() {
  // `?? {}`: tests mock env with a partial object, and a missing block must
  // read as "not configured", never as a TypeError in an unrelated suite.
  const w = env.whatsapp ?? {}
  return !!(w.accessToken && w.phoneNumberId && w.verifyToken && w.appSecret)
}

function devEcho() {
  return env.nodeEnv === 'development' && !whatsappConfigured()
}

/** Admin System Monitor readout. Read-only. */
export function whatsappStatus() {
  const w = env.whatsapp ?? {}
  return {
    configured: whatsappConfigured(),
    mode: devEcho() ? 'dev-echo' : whatsappConfigured() ? 'cloud-api' : 'off',
    listingLiveTemplate: !!w.listingLiveTemplate,
    otpTemplate: !!w.otpTemplate,
  }
}

const clip = (s, n) => (s == null ? s : String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))

// ── Outbound ───────────────────────────────────────────────────────────────

async function recordOutbound({ phone, conversationId, type, payload, waMessageId, status, error }) {
  try {
    return await prisma.whatsAppMessage.create({
      data: {
        waMessageId: waMessageId ?? `local.${crypto.randomUUID()}`,
        phone, conversationId: conversationId ?? null, direction: 'OUT', type, payload, status, error: error ?? null,
        processedAt: new Date(),
      },
    })
  } catch (err) {
    // A transcript row failing must never lose the message itself.
    log('record_failed', { error: err.message })
    return null
  }
}

async function post(body) {
  const w = env.whatsapp
  const res = await fetch(`${GRAPH}/${w.apiVersion}/${w.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${w.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = json?.error?.message ?? `HTTP ${res.status}`
    throw new Error(`whatsapp ${res.status}: ${String(detail).slice(0, 200)}`)
  }
  return json?.messages?.[0]?.id ?? null
}

/**
 * The one send path. `payload` is the Cloud API message object minus the
 * envelope (`messaging_product`, `to`). Returns the Meta message id, or null.
 */
export async function send(to, payload, { conversationId, kind } = {}) {
  const type = kind ?? payload.type ?? 'text'
  const masked = toMasked(to)

  if (devEcho()) {
    const id = `devecho.${crypto.randomUUID()}`
    console.log(`\n[whatsapp dev-echo] To: ${masked}\n${JSON.stringify(payload, null, 2)}\n`)
    await recordOutbound({ phone: to, conversationId, type, payload, waMessageId: id, status: 'SENT' })
    return id
  }

  if (!whatsappConfigured()) {
    log('dropped', { to: masked, type, reason: 'not configured' })
    await recordOutbound({ phone: to, conversationId, type, payload, status: 'SEND_FAILED', error: 'not configured' })
    return null
  }

  const startedAt = Date.now()
  try {
    const id = await post({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload })
    await recordOutbound({ phone: to, conversationId, type, payload, waMessageId: id, status: 'SENT' })
    log('sent', { to: masked, type, ms: Date.now() - startedAt })
    return id
  } catch (err) {
    await recordOutbound({ phone: to, conversationId, type, payload, status: 'SEND_FAILED', error: err.message })
    log('send_failed', { to: masked, type, error: err.message, ms: Date.now() - startedAt })
    return null
  }
}

export function sendText(to, body, opts) {
  return send(to, { type: 'text', text: { preview_url: true, body: clip(body, 4096) } }, opts)
}

/** Up to three reply buttons. `buttons: [{ id, title }]`. */
export function sendButtons(to, { body, buttons, header, footer }, opts) {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header && { header: { type: 'text', text: clip(header, 60) } }),
      body: { text: clip(body, 1024) },
      ...(footer && { footer: { text: clip(footer, 60) } }),
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: clip(b.title, 20) } })),
      },
    },
  }, { ...opts, kind: 'interactive.button' })
}

/** A pick-one list. `rows: [{ id, title, description? }]`, ≤ 10. */
export function sendList(to, { body, buttonText = 'Choose', rows, header, footer, sectionTitle }, opts) {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header && { header: { type: 'text', text: clip(header, 60) } }),
      body: { text: clip(body, 1024) },
      ...(footer && { footer: { text: clip(footer, 60) } }),
      action: {
        button: clip(buttonText, 20),
        sections: [{
          title: clip(sectionTitle ?? 'Options', 24),
          rows: rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: clip(r.title, 24),
            ...(r.description && { description: clip(r.description, 72) }),
          })),
        }],
      },
    },
  }, { ...opts, kind: 'interactive.list' })
}

/**
 * A pre-approved template — the only thing Meta delivers outside the 24-hour
 * window after the person's last message. `params` fill the body's {{n}}
 * placeholders in order; `buttonUrlParam` fills a dynamic-URL button's suffix.
 */
export function sendTemplate(to, { name, language, params = [], buttonUrlParam }, opts) {
  const components = []
  if (params.length) {
    components.push({ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clip(String(p), 1024) })) })
  }
  if (buttonUrlParam != null) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(buttonUrlParam) }] })
  }
  return send(to, {
    type: 'template',
    template: { name, language: { code: language ?? env.whatsapp.templateLanguage }, ...(components.length && { components }) },
  }, { ...opts, kind: `template.${name}` })
}

/** Blue ticks. Best-effort, never awaited by anything that matters. */
export async function markRead(messageId) {
  if (!whatsappConfigured() || devEcho()) return
  try {
    await post({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
  } catch (err) {
    log('mark_read_failed', { error: err.message })
  }
}

// ── Inbound media ──────────────────────────────────────────────────────────

/**
 * Fetch the bytes of a media id: GET /{media-id} → a short-lived URL, then GET
 * that URL with the same bearer token. Returns { buffer, mimeType, sha256 } or
 * throws — the caller records the failure against the conversation and tells
 * the owner, so a throw here is the honest outcome.
 */
export async function downloadMedia(mediaId) {
  if (!whatsappConfigured()) throw new Error('whatsapp not configured')
  const w = env.whatsapp
  const headers = { authorization: `Bearer ${w.accessToken}` }

  const meta = await fetch(`${GRAPH}/${w.apiVersion}/${mediaId}`, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  const info = await meta.json().catch(() => null)
  if (!meta.ok || !info?.url) throw new Error(`media lookup failed (${meta.status})`)
  if (info.file_size && Number(info.file_size) > MAX_MEDIA_BYTES) throw new Error('media too large')

  const res = await fetch(info.url, { headers, signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`media download failed (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > MAX_MEDIA_BYTES) throw new Error('media too large')

  return {
    buffer,
    mimeType: info.mime_type ?? res.headers.get('content-type') ?? null,
    sha256: info.sha256 ?? crypto.createHash('sha256').update(buffer).digest('hex'),
  }
}
