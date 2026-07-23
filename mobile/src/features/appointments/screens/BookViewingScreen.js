import { ScrollView, Pressable, Text, View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AppointmentForm from '@features/appointments/components/AppointmentForm'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

export default function BookViewingScreen({ route, navigation }) {
  const { propertyId, windowStart, windowEnd } = route.params

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevronLeft" size={22} color={colors.slate800} />
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Icon name="calendar" size={18} color={colors.slate800} />
          <Text style={styles.headerTitle}>Book a viewing</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AppointmentForm
            propertyId={propertyId}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onSuccess={() => {}}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  scroll: { padding: spacing.lg },
})
