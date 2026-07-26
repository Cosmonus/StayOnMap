import { View, Text, Switch, Pressable, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'

export default function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!checked)} accessibilityRole="switch" accessibilityState={{ checked: !!checked }}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <Switch
        value={!!checked}
        onValueChange={onChange}
        trackColor={{ false: colors.slate200, true: colors.slate800 }}
        thumbColor={colors.white}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  textWrap: { flex: 1 },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
})
