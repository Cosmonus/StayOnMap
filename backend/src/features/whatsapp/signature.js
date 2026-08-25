// Webhook authentication — the two checks Meta requires, and nothing else.
//
// GET  is the one-time subscription handshake: Meta sends hub.verify_token and
//      expects hub.challenge echoed back verbatim.
// POST carries X-Hub-Signature-256: "sha256=" + HMAC-SHA256(app secret, RAW
//      body bytes). It is computed over the bytes on the wire, so the check
//      needs the raw body — which is why whatsapp.routes.js parses JSON with
//      a `verify` hook that keeps them, and why this module never touches
//      req.body.
//
// Both are pure functions of their inputs so the test suite can prove the
// refusals without an HTTP server.
import crypto from 'crypto'

export function verifyChallenge(query, verifyToken) {
  if (!verifyToken) return null
  if (query?.['hub.mode'] !== 'subscribe') return null
  if (query?.['hub.verify_token'] !== verifyToken) return null
  const challenge = query?.['hub.challenge']
  return typeof challenge === 'string' && challenge.length ? challenge : null
}

/**
 * @param {Buffer} rawBody   the request bytes, exactly as received
 * @param {string} header    the X-Hub-Signature-256 header value
 * @param {string} appSecret WHATSAPP_APP_SECRET
 */
export function verifySignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !Buffer.isBuffer(rawBody)) return false
  const [scheme, theirs] = String(header).split('=')
  if (scheme !== 'sha256' || !theirs) return false
  const ours = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const a = Buffer.from(ours, 'utf8')
  const b = Buffer.from(theirs, 'utf8')
  // Length check first: timingSafeEqual throws on unequal lengths, and a throw
  // is an oracle of exactly the kind a constant-time compare exists to close.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
