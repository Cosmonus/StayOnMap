// HTTP only. The webhook's two verbs, and the sign-in link exchange.
//
// POST answers 200 BEFORE any work is done. Meta retries a webhook that does
// not answer within a few seconds and disables one that keeps failing, so the
// only thing this handler may wait on is the signature check. Everything else
// runs after the response, serialised per number by the engine, with the
// message row (unique waMessageId) as the record that it happened.
import { env } from '../../config/env.js'
import { verifyChallenge, verifySignature } from './signature.js'
import { handleInbound } from './engine.js'
import { whatsappConfigured } from './client.js'
import { toE164 } from './phone.js'
import { consumeLoginLink } from './loginLink.service.js'
import { ok } from '../../utils/response.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

export function verify(req, res) {
  const challenge = verifyChallenge(req.query, env.whatsapp.verifyToken)
  if (!challenge) return res.status(403).send('Forbidden')
  res.status(200).send(challenge)
}

export function receive(req, res) {
  if (!whatsappConfigured()) return res.status(503).json({ success: false, error: 'WHATSAPP_NOT_CONFIGURED', statusCode: 503 })
  if (!verifySignature(req.rawBody, req.get('x-hub-signature-256'), env.whatsapp.appSecret)) {
    intelLog('whatsapp.webhook_rejected', { reason: 'bad signature' })
    return res.status(401).json({ success: false, error: 'BAD_SIGNATURE', statusCode: 401 })
  }
  // Acknowledge first.
  res.status(200).json({ success: true })

  const body = req.body
  if (body?.object !== 'whatsapp_business_account') return
  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {}
        // Delivery/read statuses arrive on the same webhook; nothing to do.
        if (!Array.isArray(value.messages)) continue
        const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]))
        for (const message of value.messages) {
          const phone = toE164(message.from)
          if (!phone) { intelLog('whatsapp.inbound_dropped', { reason: 'non-indian number' }); continue }
          handleInbound({ message, phone, contactName: names.get(message.from) ?? null })
        }
      }
    }
  } catch (err) {
    intelError('whatsapp.webhook_dispatch_failed', err, {})
  }
}

export async function exchangeLoginLink(req, res, next) {
  try {
    const result = await consumeLoginLink(req.body.token, { userAgent: req.get('user-agent'), ip: req.ip })
    ok(res, result)
  } catch (err) { next(err) }
}
