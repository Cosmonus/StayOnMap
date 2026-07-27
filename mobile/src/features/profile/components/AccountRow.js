import { Children, cloneElement, isValidElement } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

// The account screen's building blocks, shared by the renter's Account tab and
// the host's Profile tab. Mobile keeps those as two screens (the whole tab bar
// swaps with the mode), so without a shared set here the same screen drifts
// into two looks — which is exactly what had happened.
//
// These were each a standalone 64px card with its own border and an 18px label,
// stacked with gaps: six of them filled a phone screen to say six words. A
// grouped list says the same thing in half the height — the rows are related,
// so one card with hairlines between them is also more honest about that than
// six separate cards were.
//
// Distinct from MenuItem: that is a settings-page row with an icon puck. These
// carry no icons, because a label plus a count is the whole content.

// One card, hairlines between its rows. Pass AccountRows as children.
export function AccountGroup({ children }) {
  const rows = Children.toArray(children).filter(Boolean)
  return (
    <View style={styles.group}>
      {rows.map((child, i) =>
        isValidElement(child) ? cloneElement(child, { key: child.key ?? i, last: i === rows.length - 1 }) : child
      )}
    </View>
  )
}

export function AccountRow({ label, count, onPress, danger, last }) {
  return (
    <Pressable
      style={[styles.row, !last && styles.rowDivided]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
        {label}
        {/* Part of the sentence — "Visits · 1 confirmed" — not a badge, so it
            reads at a glance without decoding a colour. */}
        {count ? <Text style={styles.rowCount}> · {count}</Text> : null}
      </Text>
      {!danger && <Icon name="chevronRight" size={18} color={colors.slate500} />}
    </Pressable>
  )
}

// Which hat they are wearing, and the way to change it — one control, not two
// readings of the same fact.
//
// This was a card in the list that said "Renting" on the left and "Switch to
// hosting" on the right, so the screen named BOTH modes at once and you had to
// work out which one you were in. A segmented control shows the state as the
// selection, which is the one thing everybody already knows how to read.
//
// It belongs in ScreenHeader's `below` slot, not in the list: it switches what
// the whole app shows, so it is chrome. As the first row of a scrolling list it
// would scroll away exactly when someone wants it.
export function ModeSwitch({ hostMode, onChange }) {
  return (
    <View style={styles.segment}>
      {[false, true].map((isHost) => {
        const selected = hostMode === isHost
        const label = isHost ? 'Hosting' : 'Renting'
        return (
          <Pressable
            key={label}
            style={[styles.segmentItem, selected && styles.segmentItemActive]}
            onPress={() => { if (!selected) onChange(isHost) }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            accessibilityHint={selected ? undefined : `Switches the app to ${label.toLowerCase()}`}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    // 52 keeps every row past the 48dp Android minimum while fitting the whole
    // menu on one screen — 64 did not.
    minHeight: 52, paddingHorizontal: spacing.md,
  },
  rowDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate200 },
  rowLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  rowLabelDanger: { color: colors.danger },
  rowCount: { fontFamily: fonts.body, color: colors.slate500 },
  // Brand jade, not neutral grey: which hat you are wearing changes the whole
  // app, so it should look like the app, and the mint track reads as the
  // control's own surface rather than another white card.
  //
  // The fill is brand-700, NOT brand-600. It is the only brand value that
  // carries white text at AA (6.28:1; brand-600 is 4.36:1) — see the Color
  // System note in .claude/ui-ux.md.
  //
  // 48 sits on the segment, not the track, so the TAPPABLE area clears
  // Android's 48dp minimum (mobile/AGENTS.md §6) rather than the track clearing
  // it while each half sits under.
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  segmentItem: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentItemActive: { backgroundColor: colors.brand700, ...shadows.xs },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.brand700 },
  segmentTextActive: { fontFamily: fonts.bodySemiBold, color: colors.white },
})
