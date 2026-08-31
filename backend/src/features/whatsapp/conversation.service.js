// ConversationService — the durable half of the state machine.
//
// Every turn reads the conversation row, decides, and writes it back. The
// draft is a Json column read whole; the engine never keeps state in memory
// between messages, which is what lets a conversation survive a deploy, a
// week's silence, or the owner switching phones (the number is the key).
//
// Idempotency lives here too: recordInbound() inserts the Meta message id
// under a UNIQUE constraint, and a duplicate delivery is reported as such
// rather than processed twice.
import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import { completion } from './questionnaire/engine.js'

export const OPEN_STATUSES = ['START', 'PROPERTY_TYPE', 'QUESTIONNAIRE', 'LOCATION', 'PHOTOS', 'REVIEW', 'CONFIRMATION']
export const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED']

export function emptyDraft() {
  return { fields: {}, location: null, photos: [], photosDone: false, pending: null, flags: {} }
}

/** The one conversation this number is in the middle of, if any. */
export function findOpen(phone) {
  return prisma.whatsAppConversation.findFirst({
    where: { phone, status: { in: OPEN_STATUSES } },
    orderBy: { lastMessageAt: 'desc' },
  })
}

/** The most recent conversation of any status — for "want to list another?". */
export function findLatest(phone) {
  return prisma.whatsAppConversation.findFirst({ where: { phone }, orderBy: { lastMessageAt: 'desc' } })
}

export function create(phone, { userId = null } = {}) {
  return prisma.whatsAppConversation.create({
    data: { phone, userId, status: 'START', draft: emptyDraft() },
  })
}

/**
 * Persist a turn. `patch` may carry draft / status / currentQuestion /
 * propertyType / userId / propertyId / lastError. completionPct is derived
 * here from the draft so it can never disagree with it.
 */
export function save(conversation, patch = {}) {
  const draft = patch.draft ?? conversation.draft
  const propertyType = patch.propertyType ?? conversation.propertyType
  const data = {
    ...patch,
    draft,
    lastMessageAt: new Date(),
    completionPct: propertyType ? completion(propertyType, draft) : 0,
  }
  if ('lastError' in patch && patch.lastError) data.errorCount = { increment: 1 }
  return prisma.whatsAppConversation.update({ where: { id: conversation.id }, data })
}

export function cancel(conversation) {
  return prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), lastMessageAt: new Date() },
  })
}

export function complete(conversation, propertyId) {
  return prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { status: 'COMPLETED', completedAt: new Date(), propertyId, lastMessageAt: new Date() },
  })
}

export function byId(id) {
  return prisma.whatsAppConversation.findUnique({ where: { id } })
}

export function byPropertyId(propertyId) {
  return prisma.whatsAppConversation.findFirst({ where: { propertyId }, orderBy: { updatedAt: 'desc' } })
}

/**
 * Store an inbound message. Returns { row, duplicate }. A duplicate is Meta
 * re-delivering — the row already exists and the caller must NOT process it.
 */
export async function recordInbound(message, { phone, conversationId = null }) {
  try {
    const row = await prisma.whatsAppMessage.create({
      data: {
        waMessageId: message.id,
        phone,
        conversationId,
        direction: 'IN',
        type: message.type ?? 'unknown',
        payload: message,
        status: 'RECEIVED',
      },
    })
    return { row, duplicate: false }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { row: null, duplicate: true }
    throw err
  }
}

export function markProcessed(messageRowId, { conversationId = null, error = null } = {}) {
  return prisma.whatsAppMessage.update({
    where: { id: messageRowId },
    data: { status: error ? 'FAILED' : 'PROCESSED', error, processedAt: new Date(), ...(conversationId && { conversationId }) },
  }).catch(() => null)
}
