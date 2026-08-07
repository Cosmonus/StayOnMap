/**
 * The block gate, at the send.
 *
 * Blocking has to hold at the SEND, not only in the thread list: a conversation
 * you already have open stays open after the other person blocks you, and the
 * client has no way to know it happened. The server refuses with 403 BLOCKED
 * and a real sentence — and mobile answered "Check your connection and try
 * again", which reads as a glitch and invites someone to keep hammering send at
 * a wall. Web pinned this on 2026-08-06; mobile had nothing watching, which is
 * how the two clients gave opposite answers to the same 403.
 *
 * Tested at the decision rather than through a rendered ConversationScreen: the
 * screen owns a socket, an AppState listener, typing timers and a FlatList, and
 * mounting all of it to assert one sentence tests the harness. Web already
 * covers the rendered path.
 */
import { sendErrorMessage, NETWORK_FALLBACK } from './sendError'

// What mobile's axios interceptor actually rejects with — the response
// ENVELOPE, not an axios error. `error` is the code, `message` is the sentence.
const BLOCKED = { success: false, error: 'BLOCKED', message: 'You can no longer message this person', statusCode: 403 }

describe('a refusal the server explained', () => {
  it('shows the server’s sentence, not the network line', () => {
    expect(sendErrorMessage(BLOCKED)).toBe('You can no longer message this person')
    expect(sendErrorMessage(BLOCKED)).not.toMatch(/connection/i)
  })

  it('never says who blocked whom', () => {
    // "you blocked them" and "they blocked you" are different facts, and only
    // one is safe to tell — naming it turns a block into a signal the blocked
    // person can act on. The wording is the server's
    // (features/users/safety.service.js); this asserts we pass it through
    // rather than embellishing it.
    expect(sendErrorMessage(BLOCKED)).not.toMatch(/blocked you|you blocked|they blocked/i)
  })

  it('passes through any other explained refusal too', () => {
    const gone = { error: 'NOT_FOUND', message: 'This conversation no longer exists' }
    expect(sendErrorMessage(gone)).toBe('This conversation no longer exists')
  })
})

describe('a request that never reached the server', () => {
  it('keeps the friendly line instead of showing "Network Error"', () => {
    expect(sendErrorMessage(Object.assign(new Error('Network Error'), {}))).toBe(NETWORK_FALLBACK)
  })

  it('handles a thrown nothing', () => {
    expect(sendErrorMessage(undefined)).toBe(NETWORK_FALLBACK)
    expect(sendErrorMessage(null)).toBe(NETWORK_FALLBACK)
    expect(sendErrorMessage({})).toBe(NETWORK_FALLBACK)
  })

  it('does not show a code with no sentence behind it', () => {
    // An envelope with a code but no message would otherwise render "undefined"
    // in an alert box.
    expect(sendErrorMessage({ error: 'BLOCKED' })).toBe(NETWORK_FALLBACK)
  })
})
