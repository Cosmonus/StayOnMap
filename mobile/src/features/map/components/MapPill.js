import { Text, Pressable, ActivityIndicator, StyleSheet, View } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The map's floating control pill — every button in the row above the map is
// one of these: Metro, IT Zones, Traffic, Near me.
//
// One component rather than a style each side agrees to copy. Near me and the
// layer toggles were two implementations of "a pill" that had already drifted
// into different heights, radii and shadows; the fix is not to re-match them,
// it is to have one.
//
// `activeColor` fills the pill (a layer that is ON). `busy` swaps the icon for
// a spinner INSIDE a fixed 14px box, so the pill keeps its exact height while
// it works — a control that grows when tapped shoves its neighbours sideways.
export default function MapPill({
  icon,
  label,
  active = false,
  activeColor,
  busy = false,
  onPress,
  accessibilityLabel,
  accessibilityState,
}) {
  const tint = active ? colors.white : colors.slate600

  return (
    <Pressable
      style={[styles.pill, active && activeColor && { backgroundColor: activeColor, borderColor: activeColor }]}
      onPress={onPress}
      // Takes the target past 48dp without making the pill itself taller —
      // mobile/AGENTS.md §6. A visually chunky pill row would eat the map.
      hitSlop={{ top: 9, bottom: 9 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
    >
      <View style={styles.glyph}>
        {busy
          ? <ActivityIndicator size="small" color={colors.brand600} />
          : <Icon name={icon} size={14} color={tint} />}
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    ...shadows.md,
  },
  // Fixed box: an ActivityIndicator is taller than a 14px icon and would
  // otherwise stretch the pill mid-tap.
  glyph: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  labelActive: { color: colors.white },
})
