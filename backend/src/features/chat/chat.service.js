import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { emitToConversation, emitToUser } from '../../lib/socket.js'

export async function getOrCreateConversation(tenantId, propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, ownerId: true, title: true } })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })
  if (property.ownerId === tenantId) throw Object.assign(new Error('Cannot message your own property'), { statusCode: 400 })

  const existing = await prisma.conversation.findUnique({
    where: { propertyId_tenantId: { propertyId, tenantId } },
    include: conversationInclude(),
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: { propertyId, tenantId, ownerId: property.ownerId },
    include: conversationInclude(),
  })
}

export async function getUserConversations(userId) {
  return prisma.conversation.findMany({
    where: { OR: [{ tenantId: userId }, { ownerId: userId }] },
    include: conversationInclude(),
    orderBy: { lastMessageAt: 'desc' },
  })
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

export async function sendMessage(conversationId, senderId, body, attachmentUrl) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  if (convo.tenantId !== senderId && convo.ownerId !== senderId) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, body, attachmentUrl },
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
  const notifBody = body.length > 0 ? (body.length > 80 ? body.slice(0, 80) + '...' : body) : '📷 Photo'
  notifyUser(recipientId, {
    type: 'MESSAGE',
    title: 'New message',
    body: notifBody,
    referenceId: conversationId,
    referenceType: 'Conversation',
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
    data: { deletedAt: new Date(), body: '', attachmentUrl: null },
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

export async function getUnreadCount(userId) {
  return prisma.message.count({
    where: {
      conversation: { OR: [{ tenantId: userId }, { ownerId: userId }] },
      senderId: { not: userId },
      isRead: false,
    },
  })
}

function conversationInclude() {
  return {
    property: { select: { id: true, title: true, rent: true, city: true, bhk: true, type: true, address: true, images: { where: { isPrimary: true }, take: 1 } } },
    tenant:   { select: { id: true, name: true, email: true, avatarUrl: true } },
    owner:    { select: { id: true, name: true, email: true, avatarUrl: true } },
    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    _count:   { select: { messages: { where: { isRead: false } } } },
  }
}
