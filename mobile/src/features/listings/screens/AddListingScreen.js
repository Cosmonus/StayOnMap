import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import OnboardingWizard from '@features/listings/components/onboarding/OnboardingWizard'
import { colors } from '@theme/colors'

// The profile requirements POST /properties enforces (requireCompleteProfile)
// are collected INSIDE the wizard now, on its review step (PublishGate.js).
// This screen used to block the whole flow behind them and send people to
// Settings — which lost the listing they had opened the app to make.
export default function AddListingScreen({ navigation }) {
  const { isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
  })

  // Leaving this wizard via the tab bar is handled in AppTabs.js (see
  // TAB_LISTENERS) — the Listings tab dismisses it so the tab always comes
  // back to the list. Nothing is lost; draftStore.js has already persisted
  // every change.

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : (
        <OnboardingWizard onDone={() => navigation.goBack()} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
