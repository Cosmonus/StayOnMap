import { View, Text, TextInput, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function LabeledInput({ label, error, multiline = false, style, ...inputProps }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError, style]}
        placeholderTextColor={colors.slate500}
        multiline={multiline}
        accessibilityLabel={label}
        {...inputProps}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    backgroundColor: colors.slate50,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.xs },
})
