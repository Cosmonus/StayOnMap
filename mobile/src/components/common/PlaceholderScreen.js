import { Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// Temporary stand-in for a tab whose real screen lands in a later build
// phase (see the mobile build-order plan) — replaced in place, not deleted.
export default function PlaceholderScreen({ title, subtitle }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, textAlign: 'center' },
})
