/**
 * Large-screen layout.
 *
 * Every value here is unreachable on the device anyone tests on, which is
 * exactly why it is pinned: a phone exercises the `compact` branch and nothing
 * else, so a regression in the tablet path is invisible until a tablet user
 * finds it.
 *
 * The property that matters most is the FIRST one: at phone width this whole
 * file must contribute nothing. It is additive at the top end, not a rewrite of
 * the bottom.
 */
import { layoutFor, centered, BREAKPOINTS, CONTENT_MAX_WIDTH } from './breakpoints'

// No react-native mock and no renderer. The decision is a pure function of
// width — `useLayout` is a one-line wrapper that feeds it
// `useWindowDimensions` — so there is nothing here to stub.
//
// Mocking the module was tried first and is a trap worth recording: replacing
// react-native wholesale takes `Platform` with it and expo-modules-core reads
// `Platform.select` during jest-expo's setup, while spreading
// `jest.requireActual` eagerly evaluates RN's lazy getters. Both fail to LOAD
// the suite, with an error naming neither this file nor the thing it broke.
// Extracting the pure function was the better answer to both.
const at = (width) => layoutFor(width)

describe('layoutFor', () => {
  it('changes NOTHING on a phone', () => {
    // One column and no caps — which is what every one of these screens did
    // before breakpoints.js existed. `undefined`, not the window width: a cap
    // of "the whole window" is still a cap, and it would start binding the
    // moment someone changed the number.
    for (const width of [360, 393, 411, 480, 599]) {
      const l = at(width)
      expect(l.sizeClass).toBe('compact')
      expect(l.columns).toBe(1)
      expect(l.isLarge).toBe(false)
      expect(l.contentMaxWidth).toBeUndefined()
      expect(l.gridMaxWidth).toBeUndefined()
    }
  })

  it('treats 600dp as large — Google\'s own threshold, not one we invented', () => {
    // Play measures "large screen" at sw600dp and Android 16 stops honouring
    // the portrait lock at the same number. Picking our own would mean the app
    // and the platform disagreed about what a tablet is.
    expect(BREAKPOINTS.medium).toBe(600)
    expect(at(599).isLarge).toBe(false)
    expect(at(600).isLarge).toBe(true)
  })

  it('gives a tablet two columns and a wide one three', () => {
    expect(at(600).columns).toBe(2)   // tablet portrait
    expect(at(839).columns).toBe(2)
    expect(at(840).columns).toBe(3)   // tablet landscape
    expect(at(1280).columns).toBe(3)
  })

  it('caps prose narrower than the window, at every large size', () => {
    // The point is that this does NOT track the window. A settings form or a
    // paragraph is capped at a readable measure whether the tablet is 600dp or
    // 1280 — otherwise the cap is decorative.
    for (const width of [600, 840, 1280, 2560]) {
      expect(at(width).contentMaxWidth).toBe(CONTENT_MAX_WIDTH)
    }
    expect(CONTENT_MAX_WIDTH).toBeLessThan(BREAKPOINTS.expanded)
  })

  it('responds to a resize rather than reading the window once', () => {
    // Android 16 lets a tablet be dragged into a multi-window pane mid-session,
    // so this changes while somebody is looking at it. `Dimensions.get` answers
    // once and then lies; the hook has to re-render.
    expect(at(1280).columns).toBe(3)
    expect(at(400).columns).toBe(1)
  })

  it('has no orientation branch — width is the only question', () => {
    // AGENTS.md §11: portrait-lock is intentional, don't add landscape paths
    // piecemeal. A tablet in portrait and a phone forced landscape are handled
    // by the same number, so there is nothing here to drift.
    expect(Object.keys(at(1280))).not.toContain('isLandscape')
    expect(Object.keys(at(1280))).not.toContain('orientation')
  })
})

describe('centered', () => {
  it('is null when there is no cap, so a phone style object is untouched', () => {
    expect(centered(undefined)).toBeNull()
  })

  it('sets width alongside maxWidth', () => {
    // Without `width: '100%'`, alignSelf:'center' on a flex child with no width
    // collapses it to its content — a full-width list becomes a column as
    // narrow as its longest word, which looks like a broken layout rather than
    // a centred one.
    expect(centered(640)).toEqual({ width: '100%', maxWidth: 640, alignSelf: 'center' })
  })
})
