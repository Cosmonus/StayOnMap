// ListingDraftService's last step: a confirmed draft becomes a Property.
//
// Through the front door, on purpose. createPropertySchema validates the
// payload exactly as it validates the web wizard's; createProperty() runs the
// city/coordinate check, seeds the trust score, fires the fraud/duplicate
// evaluation and warms the spatial cell; publishProperty() moves it to PENDING
// and emails every admin. None of that is re-implemented here, which is the
// whole reason a WhatsApp listing is indistinguishable from a web one once it
// exists.
//
// A Zod failure is translated into the question that would fix it, so the bot
// asks again instead of showing the owner a schema error.
import { prisma } from '../../lib/prisma.js'
import { createPropertySchema } from '../properties/properties.validation.js'
import { createProperty, publishProperty } from '../properties/properties.service.js'
import { buildPropertyPayload } from './questionnaire/normalize.js'
import { findQuestion } from './questionnaire/engine.js'
import { ensureOwnerRole, ensureBusiness, fillCityIfEmpty, getUser } from './identity.service.js'
import { CATEGORIES } from './questionnaire/schemas.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

// Zod path → the questionnaire field to re-ask. Anything not here surfaces as
// a plain sentence.
const PATH_TO_FIELD = {
  rent: 'rent', deposit: 'deposit', bhk: 'bhk', sharing: 'sharing', landType: 'landType', extent: 'extent',
  commercialType: 'commercialType', placeType: 'placeType', nightlyRate: 'nightlyRate', maxGuests: 'maxGuests',
  images: 'photos', pincode: 'location', address: 'location', city: 'location', lat: 'location', lng: 'location',
  floor: 'floor', totalFloors: 'totalFloors', carpetArea: 'carpetArea',
}

/**
 * @returns {Promise<{ ok: true, property } | { ok: false, kind: 'validation', problems: string[], reask: string[] } | { ok: false, kind: 'error', error }>}
 */
export async function publishFromConversation(conversation) {
  const category = conversation.propertyType
  const draft = conversation.draft ?? {}
  if (!category || !CATEGORIES[category]) return { ok: false, kind: 'error', error: 'no category' }

  let user = await getUser(conversation.userId)
  if (!user) return { ok: false, kind: 'error', error: 'no user' }
  if (user.isBlocked) return { ok: false, kind: 'error', error: 'blocked' }

  user = await ensureOwnerRole(user)
  if (CATEGORIES[category].tier === 'biz') user = await ensureBusiness(user)
  user = await fillCityIfEmpty(user, draft.location?.city)

  const amenities = await prisma.amenity.findMany({ select: { id: true, name: true } })
  const amenityIdByName = new Map(amenities.map((a) => [a.name, a.id]))

  const payload = buildPropertyPayload(category, draft, amenityIdByName)
  const parsed = createPropertySchema.safeParse(payload)
  if (!parsed.success) {
    const problems = []
    const reask = new Set()
    for (const issue of parsed.error.issues) {
      const key = String(issue.path?.[0] ?? '')
      const field = PATH_TO_FIELD[key]
      const q = field ? findQuestion(category, field) : null
      if (q) reask.add(q.id)
      problems.push(q ? `${q.label.replace(/\?$/, '')} — ${issue.message}` : issue.message)
    }
    intelLog('whatsapp.publish_validation_failed', { conversationId: conversation.id, problems: problems.length })
    return { ok: false, kind: 'validation', problems, reask: [...reask] }
  }

  try {
    const property = await createProperty(user.id, parsed.data)
    const published = await publishProperty(property.id, user.id)
    intelLog('whatsapp.published', { conversationId: conversation.id, propertyId: property.id, status: published.status })
    return { ok: true, property: published }
  } catch (err) {
    intelError('whatsapp.publish_failed', err, { conversationId: conversation.id })
    // A 400 from the service layer (coordinate/city mismatch, unsupported
    // city) is the owner's to fix, so it is worded as a validation problem
    // rather than a server error.
    if (err.statusCode && err.statusCode < 500) {
      return { ok: false, kind: 'validation', problems: [err.message], reask: ['location'] }
    }
    return { ok: false, kind: 'error', error: err.message }
  }
}
