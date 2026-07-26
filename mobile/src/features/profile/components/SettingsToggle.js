import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function SettingsToggle({ icon, label, hint, value, onChange, disabled = false }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!value, disabled }}
    >
      <View style={styles.iconLabel}>
        {icon && (
          <View style={styles.icon}>
            <Icon name={icon} size={16} color={colors.brand600} />
          </View>
        )}
        <View style={styles.labels}>
          <Text style={styles.label}>{label}</Text>
          {!!hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      </View>
      <View style={[styles.track, value && !disabled && styles.trackActive, disabled && styles.trackDisabled]}>
        <View style={[styles.thumb, value && !disabled && styles.thumbActive]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingRight: spacing.sm },
  icon: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  labels: { flex: 1 },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  track: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.slate200, padding: 3 },
  trackActive: { backgroundColor: colors.brand600 },
  trackDisabled: { opacity: 0.5 },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  thumbActive: { transform: [{ translateX: 18 }] },
})
