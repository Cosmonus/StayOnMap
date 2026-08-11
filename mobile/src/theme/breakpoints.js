// How wide the window is, and what that means for a layout.
//
// WIDTH, never orientation. That distinction is the whole design and it is not
// a stylistic preference:
//
//   - `mobile/AGENTS.md` §11 says portrait-lock is an intentional product
//     decision and not to add landscape paths piecemeal. This adds none. There
//     is no `isLandscape` here and there should not be.
//   - The lock does not hold anyway on the devices this file exists for.
//     Android 16 (targetSdk 36, which AGENTS.md pins) IGNORES
//     `android:screenOrientation` on displays at or above 600dp, so a tablet
//     will be landscape whether we asked for it or not — and can be resized
//     into a multi-window third of a screen on top of that.
//
// So the only honest question a layout can ask is "how much room do I have
// right now", and the answer changes at runtime. `useWindowDimensions` re-renders
// on rotation, on a fold opening, and on a multi-window drag; `Dimensions.get`
// answers once and then lies. Use the hook.
//
// A phone is UNCHANGED by all of this: below 600dp every value here is what the
// app already did — one column, no width cap. This is additive at the top end,
// not a rewrite of the bottom.
import { useWindowDimensions } from 'react-native'

// Material 3's window size classes, and Google's own large-screen threshold for
// Play's quality tiers. Borrowed rather than invented so the numbers match what
// Play measures the app against and what a tablet's own system UI assumes.
export const BREAKPOINTS = {
  // Phones, and a multi-window pane narrow enough to be one.
  compact: 0,
  // Most tablets in portrait, large foldables open, a half-screen pane.
  medium: 600,
  // Tablets in landscape, desktop-class windows.
  expanded: 840,
}

// How wide a single column of text or form fields may get.
//
// Not the window. A settings form stretched across 1280dp puts the label at one
// edge and its control at the other, and a paragraph at that width loses the
// reader on the return sweep — the same reason the web article caps its measure
// (frontend tailwind.config.js's `measure`). 640 is about 70 characters at our
// body size.
export const CONTENT_MAX_WIDTH = 640

// Card grids may run wider than prose — a card is scanned, not read. Beyond
// this a three-up row on a large tablet starts putting real distance between
// the first card and the last, which is the same argument web's `page` token
// makes at 1560.
export const GRID_MAX_WIDTH = 1100

/**
 * What a given width means. PURE — the whole decision lives here so it can be
 * tested without mocking react-native, which is the same reason
 * `features/spatial/poiConflicts.js` and `features/support/visibility.js` are
 * pure on the backend: every branch below is unreachable on the device anyone
 * actually tests on.
 *
 * @param {number} width
 * @returns {{
 *   width: number,
 *   sizeClass: 'compact'|'medium'|'expanded',
 *   isLarge: boolean,
 *   columns: number,
 *   contentMaxWidth: number|undefined,
 *   gridMaxWidth: number|undefined,
 * }}
 */
export function layoutFor(width) {
  const sizeClass = width >= BREAKPOINTS.expanded
    ? 'expanded'
    : width >= BREAKPOINTS.medium ? 'medium' : 'compact'

  const columns = sizeClass === 'expanded' ? 3 : sizeClass === 'medium' ? 2 : 1

  return {
    width,
    sizeClass,
    isLarge: sizeClass !== 'compact',
    columns,
    // `undefined` rather than the window width on a phone, deliberately: it
    // means "no cap" and leaves the existing style object untouched, so a phone
    // renders the exact same tree it did before this file existed.
    contentMaxWidth: sizeClass === 'compact' ? undefined : CONTENT_MAX_WIDTH,
    gridMaxWidth: sizeClass === 'compact' ? undefined : GRID_MAX_WIDTH,
  }
}

/** The current window's layout affordances. Re-renders on resize. */
export function useLayout() {
  return layoutFor(useWindowDimensions().width)
}

/**
 * Style for a content container that should stay readable on a wide window.
 *
 * Spread into an existing `contentContainerStyle` — it adds a cap and centres,
 * and contributes nothing at phone width.
 *
 *   const { centeredContent } = useLayout() // no: use the helper below
 */
export function centered(maxWidth) {
  // `width: '100%'` alongside maxWidth, because alignSelf:'center' on a flex
  // child with no width collapses it to its content — which turns a full-width
  // list into a column as narrow as its longest word.
  return maxWidth ? { width: '100%', maxWidth, alignSelf: 'center' } : null
}
