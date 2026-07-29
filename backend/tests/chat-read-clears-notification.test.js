/**
 * Seeing a conversation clears everything that was pointing at it.
 *
 * The unread messages and the MESSAGE notification that announced them are two
 * records for one fact, and only the first was ever cleared — so the bell went
 * on saying "New message" about a thread the reader had finished, and the only
 * cure was clearing it by hand. A badge that survives the thing it announced
 * teaches people to ignore badges.
 *
 * The clients cannot be the rule here: three surfaces read these counts (web
 * Header, the mobile tab bar, both notification lists), a released build will
 * never learn a new one, and the symptom is quiet — a number that is merely too
 * high. So both halves happen server-side, in one function, and this pins them
 * together.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { markMessageNotificationsRead } from '../src/features/notifications/notifications.service.js'

// setup.js stubs chat.service for every other service that fires chat side
// effects. Here it IS the thing under test — importActual un-mocks only this
// module, so its prisma import still resolves to prismaMock and its
// notifications import still resolves to setup.js's stub (asserted on below).
const { getMessages, markConversationRead } = await vi.importActual('../src/features/chat/chat.service.js')

// The REAL notification writer, as opposed to the stub the chat tests assert
// against. Both are needed: one proves chat asks, the other proves what is asked
// for is narrow enough.
const { markMessageNotificationsRead: realMarkNotifications } =
  await vi.importActual('../src/features/notifications/notifications.service.js')

const CONVO = { id: 'conv-1', tenantId: 'tenant-1', ownerId: 'owner-1', propertyId: 'prop-1' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.conversation.findUnique.mockResolvedValue(CONVO)
  prismaMock.message.updateMany.mockResolvedValue({ count: 2 })
  prismaMock.message.findMany.mockResolvedValue([])
  markMessageNotificationsRead.mockResolvedValue(1)
})

describe('opening a thread', () => {
  it('marks the other person’s messages read — not your own', async () => {
    await getMessages('conv-1', 'tenant-1')

    expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', senderId: { not: 'tenant-1' }, isRead: false },
      data: { isRead: true },
    })
  })

  it('retires the MESSAGE notification for that conversation', async () => {
    await getMessages('conv-1', 'tenant-1')

    expect(markMessageNotificationsRead).toHaveBeenCalledWith('tenant-1', 'conv-1')
  })

  it('does neither for a stranger', async () => {
    await expect(getMessages('conv-1', 'someone-else')).rejects.toMatchObject({ statusCode: 403 })

    expect(prismaMock.message.updateMany).not.toHaveBeenCalled()
    expect(markMessageNotificationsRead).not.toHaveBeenCalled()
  })
})

describe('markConversationRead', () => {
  // The endpoint behind it exists for a message that lands while the thread is
  // already open: re-fetching the messages is what marks them read, and a thread
  // you are already looking at never re-fetches.
  it('clears both halves and reports what it changed', async () => {
    const result = await markConversationRead('conv-1', 'owner-1')

    expect(prismaMock.message.updateMany).toHaveBeenCalled()
    expect(markMessageNotificationsRead).toHaveBeenCalledWith('owner-1', 'conv-1')
    expect(result).toEqual({ messages: 2, notifications: 1 })
  })

  it('is idempotent — a second call changes nothing and still succeeds', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 })
    markMessageNotificationsRead.mockResolvedValue(0)

    await expect(markConversationRead('conv-1', 'owner-1')).resolves.toEqual({ messages: 0, notifications: 0 })
  })

  it('refuses a non-participant', async () => {
    await expect(markConversationRead('conv-1', 'someone-else')).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.message.updateMany).not.toHaveBeenCalled()
  })

  it('404s an unknown conversation', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null)

    await expect(markConversationRead('nope', 'tenant-1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('markMessageNotificationsRead', () => {
  it('touches only this reader’s unread MESSAGE rows for this conversation', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })

    await expect(realMarkNotifications('tenant-1', 'conv-1')).resolves.toBe(1)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'tenant-1',
        type: 'MESSAGE',
        referenceType: 'Conversation',
        referenceId: 'conv-1',
        isRead: false,
      },
      data: { isRead: true },
    })
  })
})
