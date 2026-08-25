// What the bot says AFTER the conversation: the listing went live, or it was
// sent back. Called fire-and-forget from the two places that flip a listing
// to ACTIVE (admin.service.js setPropertyStatus, verification.service.js) and
// the one that rejects it — the same hooks that already notify the owner in
// the app. Absent WhatsApp config, or a listing that was never created over
// WhatsApp, this is a no-op.
//
// Days may have passed since the owner's last message, and Meta only delivers
// a TEMPLATE outside the 24-hour window — so the go-live message is a template
// when one is configured, and a plain text attempt (logged if refused) when
// not. Either way the URLs are the payload: the listing, and a single-use
// sign-in link to manage it.
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { sendText, sendTemplate, whatsappConfigured } from './client.js'
import { byPropertyId, complete } from './conversation.service.js'
import { createLoginLink } from './loginLink.service.js'
import { track } from './analytics.js'
import * as copy from './copy.js'
import { intelError } from '../../lib/intelLog.js'

export async function onListingWentLive(propertyId) {
  try {
    if (!whatsappConfigured() && env.nodeEnv !== 'development') return
    const conversation = await byPropertyId(propertyId)
    if (!conversation || conversation.status === 'COMPLETED' || !conversation.userId) return

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, city: true, landmark: true },
    })
    if (!property) return

    const listingUrl = `${env.frontendUrl}/property/${property.id}`
    const manageUrl = await createLoginLink(conversation.userId, { next: '/list' })
    const to = conversation.phone
    const opts = { conversationId: conversation.id }

    const template = env.whatsapp.listingLiveTemplate
    let sent = null
    if (template) {
      // Body params: {{1}} title, {{2}} listing URL, {{3}} manage URL. The
      // template's own text is authored in Meta's console.
      sent = await sendTemplate(to, { name: template, params: [property.title, listingUrl, manageUrl] }, opts)
    }
    if (!sent) {
      sent = await sendText(to, copy.listingLive({
        category: conversation.propertyType,
        fields: conversation.draft?.fields ?? {},
        locality: [conversation.draft?.location?.locality, property.city].filter(Boolean).join(', '),
        listingUrl, manageUrl,
      }), opts)
    }

    await complete(conversation, propertyId)
    track(conversation, 'wa_verification_passed')
    track(conversation, 'wa_listing_published', { delivered: !!sent })
  } catch (err) {
    intelError('whatsapp.listing_live_notify_failed', err, { propertyId })
  }
}

export async function onListingRejected(propertyId, note) {
  try {
    if (!whatsappConfigured() && env.nodeEnv !== 'development') return
    const conversation = await byPropertyId(propertyId)
    if (!conversation || !conversation.userId || conversation.status !== 'VERIFICATION') return
    const manageUrl = await createLoginLink(conversation.userId, { next: '/list' })
    await sendText(conversation.phone, copy.listingRejected({ note, manageUrl }), { conversationId: conversation.id })
    track(conversation, 'wa_verification_failed', { note: note ? 'given' : 'none' })
  } catch (err) {
    intelError('whatsapp.listing_rejected_notify_failed', err, { propertyId })
  }
}
