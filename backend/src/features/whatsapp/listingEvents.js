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
import { byPropertyId, complete, save } from './conversation.service.js'
import { missingProfileFields } from '../../middlewares/requireCompleteProfile.middleware.js'
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

/**
 * The profile just changed — release every WhatsApp listing held on it.
 *
 * Called fire-and-forget from the three places a profile can become complete:
 * a profile edit (users.service.js), the emailed sign-in code and the
 * verification link (auth.service.js — both set isVerified, which for a
 * WhatsApp owner is the only thing usually missing). Re-checks the gate
 * itself rather than trusting the caller, so a call on an incomplete profile
 * is a no-op and never a way to skip the rule.
 *
 * DRAFT / REJECTED go through publishProperty (→ PENDING, admins emailed);
 * a listing already moved on the website is only re-labelled. The WhatsApp
 * message is best-effort — days may have passed, and outside the 24h window
 * Meta drops a plain text; the in-app notification the hold created and the
 * usual listing-live message still reach them.
 */
export async function onProfileCompleted(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, city: true, isVerified: true, isBlocked: true },
    })
    if (!user || user.isBlocked || missingProfileFields(user).length) return []
    const held = await prisma.whatsAppConversation.findMany({
      where: { userId, status: 'AWAITING_PROFILE', propertyId: { not: null } },
      select: { id: true, phone: true, propertyId: true, propertyType: true, draft: true },
    })
    if (!held.length) return []
    // Dynamic: properties.service sits upstream of the two files that call
    // this, and a static import here would close a cycle at module load.
    const { publishProperty } = await import('../properties/properties.service.js')
    const released = []
    for (const conv of held) {
      const p = await prisma.property.findUnique({ where: { id: conv.propertyId }, select: { status: true, ownerId: true } })
      if (!p || p.ownerId !== userId) continue
      if (p.status === 'ACTIVE') { await complete(conv, conv.propertyId); continue }
      if (p.status === 'DRAFT' || p.status === 'REJECTED') await publishProperty(conv.propertyId, userId)
      await save(conv, { status: 'VERIFICATION' })
      released.push(conv.propertyId)
      track(conv, 'wa_publish_confirmed', { released: true })
      if (whatsappConfigured() || env.nodeEnv === 'development') {
        await sendText(conv.phone, copy.releasedForVerification(conv.propertyType), { conversationId: conv.id })
      }
    }
    return released
  } catch (err) {
    intelError('whatsapp.profile_release_failed', err, { userId })
    return []
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
