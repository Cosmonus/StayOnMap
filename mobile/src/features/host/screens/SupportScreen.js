import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Simple placeholder, mirrors web's ComingSoon stub (DashboardPage.jsx) —
// registered under both ProfileStack (renter mode) and DashboardStack
// (host mode), same stateless component in both places.
export default function SupportScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevronLeft" size={20} color={colors.slate800} />
        </Pressable>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Icon name="info" size={24} color={colors.slate400} />
        </View>
        <Text style={styles.title}>Help &amp; Support</Text>
        <Text style={styles.subtitle}>Get help with listings, appointments, and anything else.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  icon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, textAlign: 'center', maxWidth: 260 },
})
