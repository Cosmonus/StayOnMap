// Jest setup for the mobile suite.
//
// jest-expo's preset already stubs most of the Expo surface. What is left is
// the handful of native modules this app pulls in that have no JS fallback —
// each one throws at import time in a test process, which fails a test for a
// reason unrelated to what it is checking.

// Reanimated ships its own mock; it must be installed before anything imports
// the library (the filter RangeSlider does).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

// Maps need a real key, a network and a native view. Nothing under test asserts
// on map internals — the components that matter are the ones AROUND the map.
jest.mock('react-native-maps', () => {
  const { View } = require('react-native')
  const Mock = (props) => <View {...props} />
  return {
    __esModule: true,
    default: Mock,
    Marker: Mock,
    Polyline: Mock,
    Circle: Mock,
    Callout: Mock,
    PROVIDER_GOOGLE: 'google',
  }
})

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

// Sockets would try to open a real connection on import.
jest.mock('socket.io-client', () => ({
  io: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), disconnect: jest.fn(), connected: false }),
}))

// Silence the one warning React Native prints on every render in a test
// process. A suite that shouts on success trains people to ignore it.
jest.spyOn(console, 'warn').mockImplementation((msg, ...rest) => {
  if (typeof msg === 'string' && msg.includes('useNativeDriver')) return
  console.info(msg, ...rest)
})
