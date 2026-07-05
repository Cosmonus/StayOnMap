import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import OnboardingWizard from '@features/listings/components/onboarding/OnboardingWizard'
import { colors } from '@theme/colors'

export default function AddListingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <OnboardingWizard onDone={() => navigation.goBack()} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
})
