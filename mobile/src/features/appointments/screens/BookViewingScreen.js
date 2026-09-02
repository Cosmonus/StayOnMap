import { ScrollView, KeyboardAvoidingView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AppointmentForm from '@features/appointments/components/AppointmentForm'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { spacing } from '@theme/spacing'

const SCREEN_TITLE = {
  SHORT_STAY: 'Book your stay',
  LAND: 'Request a site visit',
  COMMERCIAL: 'Request an inspection',
}

export default function BookViewingScreen({ route, navigation }) {
  const { contentMaxWidth } = useLayout()
  const { propertyId, type, minNights, maxNights, windowStart, windowEnd } = route.params

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={SCREEN_TITLE[type] ?? 'Request a visit'} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={[styles.scroll, centered(contentMaxWidth)]} keyboardShouldPersistTaps="handled">
          <AppointmentForm
            propertyId={propertyId}
            type={type}
            minNights={minNights}
            maxNights={maxNights}
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
