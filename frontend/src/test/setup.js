import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom implements neither of these, and both are used by components that have
// nothing to do with the behaviour under test — an unstubbed one fails a test
// for a reason unrelated to what it is checking.
globalThis.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.scrollTo ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

// The Maps SDK is never loaded in a test — it needs a real key, a network, and
// a canvas. Anything that touches it is stubbed per-test; this only stops an
// import-time `window.google.maps` read from throwing.
globalThis.google ??= { maps: {} }

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})
