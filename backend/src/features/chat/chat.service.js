import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { emitToConversation, emitToUser } from '../../lib/socket.js'

// `requesterId` is the authenticated caller. It differs from `tenantId` only
// when an owner opens a thread with one of their tenants — in which case the
// caller must actually own the property, or anyone could forge a conversation
// between two unrelated users and read back both parties' details.
export async function getOrCreateConversation(tenantId, propertyId, requesterId = tenantId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, ownerId: true, title: true } })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })
  if (property.ownerId === tenantId) throw Object.assign(new Error('Cannot message your own property'), { statusCode: 400 })
  if (requesterId !== tenantId && requesterId !== property.ownerId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  }

  const existing = await prisma.conversation.findUnique({
    where: { propertyId_tenantId: { propertyId, tenantId } },
    include: conversationInclude(requesterId),
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: { propertyId, tenantId, ownerId: property.ownerId },
    include: conversationInclude(requesterId),
  })
}

export async function getUserConversations(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ tenantId: userId }, { ownerId: userId }] },
    include: conversationInclude(userId),
    orderBy: { lastMessageAt: 'desc' },
  })
  if (conversations.length === 0) return conversations

  const [visits, replyMinutes] = await Promise.all([
    visitContextFor(conversations),
    ownerReplyMinutesFor(conversations),
  ])

  return conversations.map((c) => ({
    ...c,
    visit: visits.get(c.id) ?? null,
    ownerReplyMinutes: replyMinutes.get(c.ownerId) ?? null,
  }))
}

// The appointment this thread is about, if there is one.
//
// A conversation is always (property, tenant) and an appointment is always
// (property, tenant) too, so the join is exact — no guessing. Cancelled and
// rejected visits are excluded: a banner about a visit that isn't happening is
// worse than no banner. Two queries for the whole list, not one per row.
async function visitContextFor(conversations) {
  const rows = await prisma.appointment.findMany({
    where: {
      propertyId: { in: [...new Set(conversations.map((c) => c.propertyId))] },
      tenantId: { in: [...new Set(conversations.map((c) => c.tenantId))] },
      status: { in: ['PENDING', 'ACCEPTED', 'RESCHEDULED'] },
    },
    select: { propertyId: true, tenantId: true, status: true, requestedDate: true, requestedTime: true, scheduledAt: true },
    orderBy: { requestedDate: 'desc' },
  })

  // Keyed on the pair, so an owner's threads with two different tenants about
  // the same property can never borrow each other's visit.
  const byPair = new Map()
  for (const r of rows) {
    const key = `${r.propertyId}:${r.tenantId}`
    if (!byPair.has(key)) byPair.set(key, r) // first = latest, from the orderBy
  }

  const out = new Map()
  for (const c of conversations) {
    const visit = byPair.get(`${c.propertyId}:${c.tenantId}`)
    if (visit) out.set(c.id, visit)
  }
  return out
}

// How long this owner actually takes to reply, in minutes — median, measured
// from their own message history.
//
// MEASURED, not promised: we time the gap between the other party's message and
// the owner's next one, and report nothing at all below MIN_REPLY_SAMPLES. An
// invented "replies quickly" badge on an owner who has answered twice would be
// the platform vouching for something it doesn't know.
const MIN_REPLY_SAMPLES = 3
const REPLY_WINDOW_MESSAGES = 40

async function ownerReplyMinutesFor(conversations) {
  const rows = await prisma.message.findMany({
    where: { conversationId: { in: conversations.map((c) => c.id) } },
    select: { conversationId: true, senderId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: conversations.length * REPLY_WINDOW_MESSAGES,
  })

  const ownerOf = new Map(conversations.map((c) => [c.id, c.ownerId]))
  const byThread = new Map()
  for (const m of rows) {
    if (!byThread.has(m.conversationId)) byThread.set(m.conversationId, [])
    byThread.get(m.conversationId).push(m)
  }

  // Gaps collected per OWNER across their threads — one owner's responsiveness
  // is one fact about them, not a different fact in every conversation.
  const gapsByOwner = new Map()
  for (const [conversationId, msgs] of byThread) {
    const ownerId = ownerOf.get(conversationId)
    const chron = msgs.slice().reverse() // the query was newest-first
    for (let i = 1; i < chron.length; i++) {
      const prev = chron[i - 1]
      const curr = chron[i]
      if (curr.senderId !== ownerId || prev.senderId === ownerId) continue
      const minutes = (new Date(curr.createdAt) - new Date(prev.createdAt)) / 60000
      if (minutes < 0) continue
      if (!gapsByOwner.has(ownerId)) gapsByOwner.set(ownerId, [])
      gapsByOwner.get(ownerId).push(minutes)
    }
  }

  const out = new Map()
  for (const [ownerId, gaps] of gapsByOwner) {
    if (gaps.length < MIN_REPLY_SAMPLES) continue
    gaps.sort((a, b) => a - b)
    out.set(ownerId, Math.round(gaps[Math.floor(gaps.length / 2)]))
  }
  return out
}

export async function getMessages(conversationId, userId, { skip = 0, limit = 50 } = {}) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  if (convo.tenantId !== userId && convo.ownerId !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  }

  // Mark unread messages from the other person as read
  const { count } = await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  })
  if (count > 0) {
    emitToConversation(conversationId, 'message:read', { conversationId, readerId: userId, readAt: new Date() })
  }

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    skip,
    take: limit,
    include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  })
}

export async function sendMessage(conversationId, senderId, body, attachment = {}) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  if (convo.tenantId !== senderId && convo.ownerId !== senderId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        body,
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentMime: attachment.mime,
      },
      include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ])

  // Real-time: emit to conversation room + recipient's personal channel
  const recipientId = convo.tenantId === senderId ? convo.ownerId : convo.tenantId
  emitToConversation(conversationId, 'message:new', message)
  emitToUser(recipientId, 'message:notification', { conversationId, message })

  // Persist notification for offline fallback
  const notifBody = body.length > 0
    ? (body.length > 80 ? body.slice(0, 80) + '...' : body)
    : attachment.mime === 'application/pdf'
      ? `📄 ${attachment.name || 'Document'}`
      : '📷 Photo'
  notifyUser(recipientId, {
    type: 'MESSAGE',
    title: 'New message',
    body: notifBody,
    referenceId: conversationId,
    referenceType: 'Conversation',
    // The hat is the side of the thread they're on — the same partition the
    // inbox and its badge use, so a message notification lands in the mode that
    // can actually open the conversation.
    audience: convo.ownerId === recipientId ? 'OWNER' : 'TENANT',
  }).catch(() => {})

  return message
}

export async function editMessage(conversationId, messageId, userId, body) {
  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message || message.conversationId !== conversationId) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 })
  }
  if (message.senderId !== userId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  if (message.deletedAt) throw Object.assign(new Error('Cannot edit a deleted message'), { statusCode: 409 })
  // Once the other person has read it, the words are theirs too — editing then
  // rewrites what they already saw, and the only trace is a small "edited"
  // label they have no reason to re-read. Deleting stays allowed: it leaves
  // "This message was deleted", so they can see that something was withdrawn.
  //
  // Enforced here, not just hidden in the clients: both hide the button, but
  // the button is not the rule.
  if (message.isRead) {
    throw Object.assign(new Error('This message has already been read and can no longer be edited'), { statusCode: 409 })
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
    include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  })

  emitToConversation(conversationId, 'message:edited', updated)
  return updated
}

export async function deleteMessage(conversationId, messageId, userId) {
  const message = await prisma.message.findUnique({ where: { id: messageId } })
  if (!message || message.conversationId !== conversationId) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 })
  }
  if (message.senderId !== userId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: '', attachmentUrl: null, attachmentName: null, attachmentMime: null },
  })

  emitToConversation(conversationId, 'message:deleted', { id: messageId, conversationId })
  return { id: messageId }
}

export async function searchMessages(conversationId, userId, q) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  if (convo.tenantId !== userId && convo.ownerId !== userId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  }

  return prisma.message.findMany({
    where: { conversationId, deletedAt: null, body: { contains: q, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  })
}

// Split by HAT, because the inbox itself is (see getUserConversations' callers:
// host mode lists threads where you're the owner, renter mode where you're the
// tenant). A single whole-account total badged the host's Inbox for a message
// in a thread host mode does not show — the badge said 1 and the list was
// empty, with no way to find the message but to flip modes.
//
// `count` stays the whole-account total so released clients keep working.
export async function getUnreadCount(userId) {
  const unread = { senderId: { not: userId }, isRead: false }
  const [asTenant, asOwner] = await Promise.all([
    prisma.message.count({ where: { ...unread, conversation: { tenantId: userId } } }),
    prisma.message.count({ where: { ...unread, conversation: { ownerId: userId } } }),
  ])
  return { count: asTenant + asOwner, asTenant, asOwner }
}

function conversationInclude(userId) {
  return {
    property: { select: { id: true, title: true, rent: true, pricingModel: true, city: true, bhk: true, sharing: true, type: true, address: true, landmark: true, images: { where: { isPrimary: true }, take: 1 } } },
    tenant:   { select: { id: true, name: true, email: true, avatarUrl: true } },
    owner:    { select: { id: true, name: true, email: true, avatarUrl: true } },
    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    // Unread = the OTHER person's unread messages, like getUnreadCount above.
    // Without the senderId exclusion, sending a message badged the SENDER's
    // own conversation row until the recipient read it.
    _count:   { select: { messages: { where: { isRead: false, ...(userId ? { senderId: { not: userId } } : {}) } } } },
  }
}
