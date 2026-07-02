import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuth } from '@features/auth/hooks/useAuth'
import { colors } from '@theme/colors'
import AuthStack from './AuthStack'
import AppTabs from './AppTabs'
import { navigationRef } from './navigationRef'

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
    <NavigationContainer ref={navigationRef}>
      {user ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}
