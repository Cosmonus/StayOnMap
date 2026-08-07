// What to tell someone whose message did not send.
//
// There are two failures behind one symptom, and they need opposite advice:
//
//   the request never arrived   → "check your connection" — retrying is right
//   the server refused it       → the server's own sentence; retrying is futile
//
// A block is the second kind: 403 BLOCKED, "You can no longer message this
// person". ConversationScreen used to answer "Check your connection and try
// again" for both, so a blocked person read a network glitch and kept hammering
// send at a wall. Web fixed the same bug on 2026-08-06 (MessageThread.jsx).
//
// Extracted so the DECISION is testable without mounting a chat screen — that
// screen owns a socket, an AppState listener, typing timers and a FlatList, and
// a test that renders all of it to assert one sentence tests the harness.
export const NETWORK_FALLBACK = 'Check your connection and try again.'

/**
 * `err.error` is the API envelope's code. Its presence is what proves a SERVER
 * answered: mobile's axios interceptor rejects with `err.response.data` when
 * there is a response, and with the raw axios error when there is not — and the
 * raw one's `message` is "Network Error", which is not something to show
 * anybody.
 */
export function sendErrorMessage(err) {
  return err?.error && err?.message ? err.message : NETWORK_FALLBACK
}
