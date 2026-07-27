/**
 * editMessage — you may fix your words until they have been read, not after.
 *
 * Once the other person has read it, the message is part of a conversation
 * they remember. Editing then rewrites what they saw, and the only trace is a
 * small "edited" label they have no reason to re-read. Deleting stays allowed
 * at any time because it leaves "This message was deleted" — visibly a gap,
 * not a substitution.
 *
 * Both clients hide the Edit affordance on a read message, which is why this
 * test exists: the button is not the rule. A client that forgets, an older
 * released build, or a direct API call must all hit the same wall.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

// tests/setup.js stubs this whole module, because other services import it to
// fire chat side effects and do not want the real thing. Here it IS the thing
// under test, so pull the real implementation — importActual un-mocks only the
// named module, so its own prisma import still resolves to prismaMock.
const { editMessage, deleteMessage } = await vi.importActual('../src/features/chat/chat.service.js')

function makeMessage(overrides = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    body: 'the original wording',
    isRead: false,
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('editMessage read window', () => {
  it('allows an edit while the message is still unread', async () => {
    prismaMock.message.findUnique.mockResolvedValue(makeMessage({ isRead: false }))
    prismaMock.message.update.mockResolvedValue(makeMessage({ body: 'fixed', editedAt: new Date() }))

    await expect(editMessage('conv-1', 'msg-1', 'user-1', 'fixed')).resolves.toBeTruthy()
    expect(prismaMock.message.update).toHaveBeenCalled()
  })

  it('refuses once the message has been read', async () => {
    prismaMock.message.findUnique.mockResolvedValue(makeMessage({ isRead: true }))

    await expect(editMessage('conv-1', 'msg-1', 'user-1', 'rewritten'))
      .rejects.toMatchObject({ statusCode: 409 })

    // The important half: it must not have written anything.
    expect(prismaMock.message.update).not.toHaveBeenCalled()
  })

  it('still refuses a deleted message, read or not', async () => {
    prismaMock.message.findUnique.mockResolvedValue(makeMessage({ deletedAt: new Date() }))

    await expect(editMessage('conv-1', 'msg-1', 'user-1', 'anything'))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.message.update).not.toHaveBeenCalled()
  })

  it('refuses someone else’s message before it considers the read state', async () => {
    prismaMock.message.findUnique.mockResolvedValue(makeMessage({ senderId: 'someone-else', isRead: false }))

    await expect(editMessage('conv-1', 'msg-1', 'user-1', 'not mine'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('leaves DELETE available on a read message', async () => {
    prismaMock.message.findUnique.mockResolvedValue(makeMessage({ isRead: true }))
    prismaMock.message.update.mockResolvedValue(makeMessage({ isRead: true, deletedAt: new Date() }))

    await expect(deleteMessage('conv-1', 'msg-1', 'user-1')).resolves.toBeTruthy()
  })
})
