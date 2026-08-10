/**
 * A reconnected socket has joined nothing.
 *
 * `lib/socket.js` rooms are per-CONNECTION — `join:conversation` puts THAT
 * socket in the room, and socket.io's reconnect gives you a new one. Both
 * clients emitted the join once, when the thread mounted, and never again. So
 * after any reconnect the open conversation silently stopped receiving
 * `message:new`, `typing` and `message:read` until it was closed and reopened:
 * the thread looked alive, the other person's messages simply never arrived.
 *
 * It was masked by the refetch already in each `connect` handler — which is why
 * this is a lint over source rather than a behavioural test. The handler
 * EXISTED and looked complete; what was missing was one line inside it, in two
 * files, on two platforms. A rendered-component test would have had to fake a
 * transport reconnect on each platform separately to see the same thing.
 *
 * Lives in the backend suite for the same reason legal-parity does: it is the
 * only suite that can read both clients at once.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CLIENTS = [
  ['web',    '../../frontend/src/features/chat/components/shared/MessageThread.jsx'],
  ['mobile', '../../mobile/src/features/chat/screens/ConversationScreen.js'],
]

/** The body of `function onConnect() { … }`, brace-matched. */
function connectHandler(src) {
  const start = src.indexOf('function onConnect()')
  if (start === -1) return null
  let depth = 0
  let i = src.indexOf('{', start)
  const open = i
  do {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  } while (i < src.length && depth > 0)
  return src.slice(open, i)
}

describe.each(CLIENTS)('%s chat thread', (_platform, path) => {
  const src = readFileSync(new URL(path, import.meta.url), 'utf8')

  it('joins the conversation room on mount', () => {
    expect(src).toMatch(/emit\(\s*'join:conversation'/)
  })

  it('has a connect handler at all', () => {
    // Guards the test: a rename would make the assertion below vacuous.
    expect(connectHandler(src), 'no onConnect() — this lint can no longer see anything').toBeTruthy()
  })

  it('re-joins the room on every reconnect, not only on mount', () => {
    expect(
      connectHandler(src),
      'onConnect refetches but does not rejoin — the thread goes silent after a reconnect',
    ).toMatch(/emit\(\s*'join:conversation'/)
  })

  it('still catches up on what it missed while disconnected', () => {
    // The rejoin restores the live feed; it cannot recover what arrived while
    // the socket was down. Both halves are load-bearing.
    expect(connectHandler(src)).toMatch(/invalidateQueries/)
  })
})
