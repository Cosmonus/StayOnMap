/**
 * Sending a message, and the one case where you cannot.
 *
 * Blocking has to hold at the SEND, not only in the list: a thread you already
 * have open is still open after the other person blocks you, and the client
 * cannot know it happened. The server refuses with 403 BLOCKED and a real
 * sentence — "You can no longer message this person" — and this handler used to
 * throw that away and say "Failed to send message" instead, which reads as a
 * network glitch and invites the person to keep hammering send at a wall.
 *
 * The neutral wording is deliberate and is asserted here: it must never reveal
 * WHICH side did the blocking (backend/src/features/users/safety.service.js).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const sendMessage = vi.fn()
const messages = vi.fn()
const markRead = vi.fn()
const toastError = vi.fn()

vi.mock('@services/chat.service', () => ({
  chatService: {
    messages: (...a) => messages(...a),
    sendMessage: (...a) => sendMessage(...a),
    markRead: (...a) => markRead(...a),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}))
vi.mock('@services/user.service', () => ({ userService: { block: vi.fn(), report: vi.fn() } }))
vi.mock('@components/common/Toaster', () => ({
  toast: { success: vi.fn(), error: (...a) => toastError(...a) },
}))
vi.mock('@components/common/ConfirmDialog', () => ({ confirm: vi.fn().mockResolvedValue(false) }))
vi.mock('@lib/socket', () => ({ getSocket: () => null, connectSocket: () => null }))

const { default: MessageThread } = await import('./MessageThread')

// What the server actually sends: `code`, not `statusCode`, and one message
// that names neither party's action.
const BLOCKED = Object.assign(new Error('You can no longer message this person'), {
  code: 'BLOCKED',
  statusCode: 403,
})

const CONVERSATION = {
  id: 'c1',
  property: { id: 'p1', title: 'A flat' },
  tenant: { id: 'u1', name: 'Renter' },
  owner: { id: 'u2', name: 'Owner' },
}

function renderThread() {
  return renderWithProviders(
    <MessageThread
      conversationId="c1"
      conversation={CONVERSATION}
      other={CONVERSATION.owner}
      counterpartRole="Owner"
      userId="u1"
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  messages.mockResolvedValue({ data: [] })
  markRead.mockResolvedValue({ data: {} })
  sendMessage.mockResolvedValue({ data: { id: 'm1', content: 'hello', senderId: 'u1', createdAt: new Date().toISOString() } })
})

describe('chat — sending', () => {
  it('sends what was typed', async () => {
    const { user } = renderThread()

    const box = await screen.findByPlaceholderText(/message/i)
    await user.type(box, 'Is it still available?')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(sendMessage.mock.calls[0][1]).toBe('Is it still available?')
  })

  it('does not send an empty message', async () => {
    const { user } = renderThread()

    const box = await screen.findByPlaceholderText(/message/i)
    await user.type(box, '   ')
    await user.keyboard('{Enter}')

    expect(sendMessage).not.toHaveBeenCalled()
  })
})

describe('chat — the block gate', () => {
  it('shows the server’s reason, not a generic failure', async () => {
    sendMessage.mockRejectedValue(BLOCKED)
    const { user } = renderThread()

    const box = await screen.findByPlaceholderText(/message/i)
    await user.type(box, 'hello?')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const [title, body] = toastError.mock.calls[0]
    expect(title).toMatch(/not sent/i)
    expect(body).toBe('You can no longer message this person')
    // The old copy. If this comes back, the reason has been discarded again.
    expect(body).not.toMatch(/failed to send/i)
  })

  it('never says who blocked whom', async () => {
    sendMessage.mockRejectedValue(BLOCKED)
    const { user } = renderThread()

    const box = await screen.findByPlaceholderText(/message/i)
    await user.type(box, 'hello?')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const said = toastError.mock.calls[0].join(' ')
    // "you blocked them" and "they blocked you" are different facts, and
    // telling someone which one it is tells them something about the other
    // person's actions. One neutral sentence covers both directions.
    expect(said).not.toMatch(/blocked you|you blocked|they blocked/i)
  })

  it('a plain network failure still gets the generic message', async () => {
    sendMessage.mockRejectedValue(new Error(''))
    const { user } = renderThread()

    const box = await screen.findByPlaceholderText(/message/i)
    await user.type(box, 'hello?')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][1]).toMatch(/failed to send/i)
  })
})
