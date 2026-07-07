import { Pressable, Text, View, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'

export default function FilterChip({ label, icon, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.slate800, borderColor: colors.slate800 },
  pressed: { transform: [{ scale: 0.96 }] },
  icon: { marginRight: 1 },
  label: { fontFamily: fonts.bodyMedium ?? fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  labelActive: { color: colors.white, fontFamily: fonts.bodySemiBold },
})
