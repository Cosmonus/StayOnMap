import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AppointmentForm from '@features/appointments/components/AppointmentForm'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

export default function BookViewingScreen({ route, navigation }) {
  const { propertyId, windowStart, windowEnd } = route.params

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book a viewing</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppointmentForm
          propertyId={propertyId}
          windowStart={windowStart}
          windowEnd={windowEnd}
          onSuccess={() => {}}
        />
      </ScrollView>
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
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  closeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600 },
  scroll: { padding: spacing.lg },
})
