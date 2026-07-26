import { ScrollView, Pressable, Text, View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AppointmentForm from '@features/appointments/components/AppointmentForm'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

export default function BookViewingScreen({ route, navigation }) {
  const { propertyId, windowStart, windowEnd } = route.params

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Request a visit" onBack={() => navigation.goBack()} />
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
  scroll: { padding: spacing.lg },
})
