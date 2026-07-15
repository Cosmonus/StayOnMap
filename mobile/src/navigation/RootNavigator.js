import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuth } from '@features/auth/hooks/useAuth'
import { colors } from '@theme/colors'
import AuthStack from './AuthStack'
import AppTabs from './AppTabs'
import { navigationRef, flushPendingReference } from './navigationRef'

// Deep links resolve against the renter tab set (AppTabs.js's RENTER_TABS) —
// the Explore stack owns PropertyDetail there.
const linking = {
  prefixes: ['stayonmap://'],
  config: {
    screens: {
      Explore: {
        screens: {
          PropertyDetail: 'property/:propertyId',
        },
      },
    },
  },
}

export default function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.brand600} size="large" />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} onReady={flushPendingReference}>
      {user ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}
