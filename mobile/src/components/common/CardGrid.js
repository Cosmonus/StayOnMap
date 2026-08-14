import { View } from 'react-native'
import { useLayout, centered } from '@theme/breakpoints'
import { spacing } from '@theme/spacing'

// Turning a single-column card list into a grid on a wide window.
//
// The lists in this app are all the same shape — data, keyExtractor, a
// contentContainerStyle, one card per row — so the wide-window handling is one
// helper rather than the same four lines copied into every screen that grows a
// list later.
//
// On a phone this is a NO-OP by construction: `columns` is 1, `numColumns={1}`
// is what FlatList already does, `itemStyle` is null and `GridItem` becomes a
// passthrough that renders no extra view. A phone renders the identical tree it
// did before this file existed.

/**
 * FlatList props for a responsive card grid.
 *
 * @param {object|Array} contentContainerStyle  the list's existing style
 * @param {number} [gap]  space between columns; match the row gap already in
 *                        the content style, or the grid looks stitched
 */
export function useCardGrid(contentContainerStyle, gap = spacing.md) {
  const { columns, gridMaxWidth } = useLayout()

  return {
    // FlatList REFUSES to change numColumns on a live list — it throws
    // "Changing numColumns on the fly is not supported". A key that includes
    // the count forces the remount it asks for, which matters here more than
    // usual: on Android 16 a tablet can be resized into a multi-window pane
    // mid-session, so this changes while the user is looking at it.
    //
    // Returned SEPARATELY, not inside listProps: React 19 errors on a spread
    // props object that contains `key`. Callers write
    // `<FlatList key={listKey} {...listProps} />`.
    listKey: `grid-${columns}`,
    listProps: {
      numColumns: columns,
      // The cap centres the grid instead of letting three columns spread to the
      // edges of a 1280dp window. Null at phone width, so the existing style
      // passes through untouched.
      contentContainerStyle: [contentContainerStyle, centered(gridMaxWidth)],
      // Only valid when there IS more than one column; RN warns otherwise.
      ...(columns > 1 ? { columnWrapperStyle: { gap } } : null),
    },
    // `flex: 1` makes siblings share a full row. `maxWidth` is what stops a
    // LONE card in a partial last row stretching across the whole width, which
    // is the giveaway that a grid was bolted on. It binds only in that case —
    // in a full row the flex-computed width is already narrower.
    itemStyle: columns > 1 ? { flex: 1, maxWidth: `${100 / columns}%` } : null,
  }
}

/**
 * Wraps a card so it can share a row. A passthrough when there is one column,
 * so the phone tree gains nothing.
 */
export function GridItem({ style, children }) {
  return style ? <View style={style}>{children}</View> : children
}
