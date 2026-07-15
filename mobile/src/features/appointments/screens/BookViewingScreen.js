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
        <View style={styles.headerTitleRow}>
          <Icon name="calendar" size={18} color={colors.slate800} />
          <Text style={styles.headerTitle}>Book a viewing</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={18} color={colors.brand600} />
        </Pressable>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  closeButton: { padding: 4 },
  scroll: { padding: spacing.lg },
})
