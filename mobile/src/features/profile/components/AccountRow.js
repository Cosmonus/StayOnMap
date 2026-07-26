import { Children, cloneElement, isValidElement } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

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

// Which hat they are wearing, and the way out of it. A statement first and a
// button second: someone opening this screen wondering why their tabs changed
// needs to SEE the mode, not hunt for a toggle labelled with the other one.
export function ModeCard({ hostMode, onSwitch }) {
  return (
    <Pressable
      style={styles.modeCard}
      onPress={onSwitch}
      accessibilityRole="button"
      accessibilityLabel={hostMode ? 'Switch to renting' : 'Switch to hosting'}
    >
      <View style={styles.modeLeft}>
        <View style={styles.modeDot} />
        <Text style={styles.modeLabel}>{hostMode ? 'Hosting' : 'Renting'}</Text>
      </View>
      <Text style={styles.modeAction}>{hostMode ? 'Switch to renting' : 'Switch to hosting'}</Text>
    </Pressable>
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
  modeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    minHeight: 52, paddingHorizontal: spacing.md,
    backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand600, borderRadius: radius.lg,
  },
  modeLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand600 },
  modeLabel: { fontFamily: fonts.displayBold, fontSize: fontSizes.base, color: colors.brand700 },
  modeAction: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
})
