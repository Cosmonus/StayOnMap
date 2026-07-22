import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import OnboardingWizard from '@features/listings/components/onboarding/OnboardingWizard'
import ProfileGate from '@features/listings/components/ProfileGate'
import { colors } from '@theme/colors'

export default function AddListingScreen({ navigation }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
  })

  // Front door for the same rule POST /properties enforces server-side
  // (requireCompleteProfile) — `missingProfileFields` is computed by that
  // exact middleware, so this gate can't disagree with the 403 it prevents.
  const missingProfile = profile?.missingProfileFields ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : missingProfile.length > 0 ? (
        <ProfileGate
          missing={missingProfile}
          onGoToSettings={() => navigation.navigate('HostProfile', { screen: 'Settings' })}
          onClose={() => navigation.goBack()}
        />
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
