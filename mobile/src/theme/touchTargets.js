// How big a thing you tap has to be.
//
// `mobile/AGENTS.md` §6 and `.claude/ui-ux.md` both say 48dp on Android, and the
// app has agreed with that in intent everywhere and missed it by a few
// pixels in twelve places — a 32dp button with `hitSlop={6}` is 44, an 18dp
// close icon with `hitSlop={14}` is 46. Every one of those was written by
// somebody who knew the rule. Nobody does this arithmetic reliably by eye,
// which is the entire reason the number is derived here instead of chosen at
// the call site.
//
// The failure mode is invisible on the device the author is holding: a 44dp
// target works fine for a person with a steady hand looking straight at it. It
// is the person with a tremor, or one hand on a bus, who misses — and they do
// not file a bug, they conclude the app does not work.

/** Android's minimum touch target. WCAG 2.5.8 asks 24; Android asks 48; we take the larger. */
export const MIN_TAP_SIZE = 48

/**
 * The `hitSlop` that lifts a control of `visualSize` dp up to `MIN_TAP_SIZE`.
 *
 *   <Pressable hitSlop={tapSlop(18)}>   // an 18dp close icon → 15 → 48dp
 *   <Pressable style={styles.btn} hitSlop={tapSlop(32)}>  // a 32dp box → 8 → 48dp
 *
 * Pass the size of the BOX THAT RENDERS — the styled container if there is one,
 * the icon if there is not. Passing the icon size when the button around it has
 * padding just buys slop nobody needs, which is harmless; passing the container
 * size when there is no container is the one that under-shoots.
 *
 * Returns 0 at or above the minimum, so it is safe to wrap anything.
 */
export function tapSlop(visualSize) {
  return Math.ceil(Math.max(0, MIN_TAP_SIZE - visualSize) / 2)
}

// WHEN NOT TO USE THIS. hitSlop extends a touch area beyond the view's bounds,
// and React Native does not arbitrate between two extended areas that overlap —
// the hit goes to whichever view is later in the tree, regardless of which one
// you were actually nearer. So slop is for an ISOLATED control: a close button
// in a corner, a heart on a card, a chevron in a header.
//
// Controls that sit side by side need REAL size instead. The five stars in the
// review form were 20dp icons 2dp apart with `hitSlop={4}`; slopping them to 48
// would have made every star's touch area swallow both its neighbours, turning
// an under-sized control into a wrong-answer one. They were given genuine
// 48dp boxes — which is also the fix the font-scaling pass reached for, and for
// the same reason: make the box big enough rather than paper over it.
