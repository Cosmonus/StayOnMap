// A renter did something that needs the OWNER to answer — asked for a visit,
// booked a stay, wrote in chat — and the owner listed by chatting with the
// bot, so the place they will actually see it is WhatsApp. The in-app
// notification, the email and the push still go out as before; this is the
// one channel a WhatsApp owner is certain to read.
//
// Who qualifies: anyone with a WhatsAppConversation row — that is exactly the
// set of owners we have a number for and permission to message. Everyone else
// is a no-op. Days may have passed since their last message, so this is a
// TEMPLATE when one is configured (WHATSAPP_OWNER_ALERT_TEMPLATE) and a
// logged plain-text attempt when not. Every send is best-effort: the visit
// request or the chat message is already saved before this runs, and nothing
// here may fail it.
//
// Chat is DEBOUNCED per thread (one alert an hour): each template send is
// metered by Meta, and ten quick messages are one conversation, not ten.
// Visit requests are never debounced — each one is a decision to make.
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { sendText, sendTemplate, whatsappConfigured } from './client.js'
import { createLoginLink } from './loginLink.service.js'
import * as copy from './copy.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

const MESSAGE_DEBOUNCE_SECONDS = 60 * 60

/**
 * @param {string} ownerId
 * @param {{ kind: 'visit' | 'stay' | 'message', propertyId?: string, detail?: string, debounceKey?: string }} alert
 * @returns {Promise<boolean>} delivered
 */
export async function alertOwner(ownerId, { kind, propertyId = null, detail = null, debounceKey = null }) {
  try {
    if (!whatsappConfigured() && env.nodeEnv !== 'development') return false
    const conv = await prisma.whatsAppConversation.findFirst({
      where: { userId: ownerId },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true, phone: true },
    })
    if (!conv) return false

    if (debounceKey) {
      const key = `wa:owner-alert:${ownerId}:${debounceKey}`
      if (await cacheGet(key)) return false
      await cacheSet(key, '1', MESSAGE_DEBOUNCE_SECONDS)
    }

    const property = propertyId
      ? await prisma.property.findUnique({ where: { id: propertyId }, select: { title: true } })
      : null
    const next = kind === 'message' ? '/user?tab=messages&mode=host' : '/user?tab=appointments&mode=host'
    const link = await createLoginLink(ownerId, { next })
    const opts = { conversationId: conv.id }

    const template = env.whatsapp.ownerAlertTemplate
    let sent = null
    if (template) {
      // Body params: {{1}} what happened, {{2}} listing title, {{3}} sign-in link.
      sent = await sendTemplate(conv.phone, { name: template, params: [copy.ownerAlertWhat(kind), property?.title ?? 'your listing', link] }, opts)
    }
    if (!sent) sent = await sendText(conv.phone, copy.ownerAlert({ kind, title: property?.title, detail, link }), opts)
    intelLog('whatsapp.owner_alert', { ownerId, kind, delivered: !!sent, template: !!template })
    return !!sent
  } catch (err) {
    intelError('whatsapp.owner_alert_failed', err, { ownerId, kind })
    return false
  }
}
