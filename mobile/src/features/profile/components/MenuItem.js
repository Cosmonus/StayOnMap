import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Lifted out of ProfileScreen.js so HostDashboardScreen can reuse the same
// row style for its own account-menu section.
export default function MenuItem({ icon, label, onPress, danger = false }) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuItemIcon, danger && styles.menuItemIconDanger]}>
        <Icon name={icon} size={16} color={danger ? colors.danger : colors.brand600} />
      </View>
      <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger]}>{label}</Text>
      <Icon name="chevronRight" size={16} color={colors.slate400} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  menuItemIcon: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  menuItemIconDanger: { backgroundColor: '#FEF2F2' },
  menuItemText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  menuItemTextDanger: { color: colors.danger },
})
