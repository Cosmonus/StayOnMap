/**
 * OfflineBanner, with its native module present — 2026-08-07
 *
 * The absent-module case is a SEPARATE file (OfflineBanner.missingModule.test.js)
 * because the two need different module mocks, and the mock has to be hoisted:
 * `jest.resetModules()` + `require()` inside a test body hands the component a
 * second copy of React ("Invalid hook call", pointing at useState), and
 * requiring react-native-testing-library in there registers an afterAll hook
 * that jest-circus rejects. Two files, two hoisted mocks, no gymnastics.
 */
import { render } from '@testing-library/react-native'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}))

const mockGetState = jest.fn()
jest.mock('expo-network', () => ({
  getNetworkStateAsync: (...args) => mockGetState(...args),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}))

const OfflineBanner = require('./OfflineBanner').default

beforeEach(() => jest.clearAllMocks())

it('names the cause when the internet is unreachable', async () => {
  mockGetState.mockResolvedValue({ isInternetReachable: false })

  const view = await render(<OfflineBanner />)
  expect(await view.findByText('No internet connection')).toBeTruthy()
})

it('stays silent while the probe has not answered yet', async () => {
  // null, not false: Android reports "don't know yet" during the probe, and
  // `=== false` (rather than `!value`) is what stops a banner flashing on
  // every cold start.
  mockGetState.mockResolvedValue({ isInternetReachable: null })

  const view = await render(<OfflineBanner />)
  expect(view.queryByText('No internet connection')).toBeNull()
})

it('stays silent when connected', async () => {
  mockGetState.mockResolvedValue({ isInternetReachable: true })

  const view = await render(<OfflineBanner />)
  expect(view.queryByText('No internet connection')).toBeNull()
})

it('does not crash when the probe itself rejects', async () => {
  mockGetState.mockRejectedValue(new Error('probe failed'))

  const view = await render(<OfflineBanner />)
  expect(view.queryByText('No internet connection')).toBeNull()
})
