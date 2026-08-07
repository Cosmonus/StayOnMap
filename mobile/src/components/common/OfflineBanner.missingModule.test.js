/**
 * A missing OPTIONAL native module must not take the app down — 2026-08-07
 *
 * THE BUG THIS PINS, reported from a running Android app:
 *
 *   ERROR  [Error: Cannot find native module 'ExpoNetwork']
 *   ERROR  [ReferenceError: Property 'OfflineBanner' doesn't exist]
 *
 * Those two lines are ONE fault, and the second names neither the package nor
 * the cause. `expo-network` reaches for its native module at IMPORT time, so on
 * a build predating the dependency — Expo Go, or a dev client not rebuilt since
 * it was added — the static import threw while OfflineBanner.js was still
 * evaluating. Its export never initialised, so App.js's `<OfflineBanner />`
 * resolved to nothing and the whole render tree died. A connectivity NICETY
 * killed the app.
 *
 * Rebuilding fixes that device. This fixes the CLASS: the module is now required
 * in a try/catch, and its absence degrades to "no banner" — the same outcome as
 * being permanently online, which is the right degradation for a component whose
 * only job is to name a cause.
 *
 * AGENTS.md §10 already required features to degrade rather than dead-end. This
 * applies that rule to the IMPORT, which is the one place it had not been.
 *
 * Its own file because the mock must be hoisted — see the sibling test's header.
 */
import { render } from '@testing-library/react-native'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}))

// Exactly what expo-network does on a build that lacks the native module.
jest.mock('expo-network', () => {
  throw new Error("Cannot find native module 'ExpoNetwork'")
})

const OfflineBanner = require('./OfflineBanner').default

it('still evaluates the module and exports a component', () => {
  // The original failure was that this produced NOTHING, which is why the app
  // reported a ReferenceError on the identifier rather than a module error.
  expect(typeof OfflineBanner).toBe('function')
})

it('mounts and renders nothing, instead of crashing the app', async () => {
  const view = await render(<OfflineBanner />)
  expect(view.queryByText('No internet connection')).toBeNull()
})
