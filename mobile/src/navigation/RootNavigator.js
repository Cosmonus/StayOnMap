import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { colors } from '@theme/colors'
import AuthStack from './AuthStack'
import AppTabs from './AppTabs'
import OAuthRedirectHandler from '@features/auth/components/OAuthRedirectHandler'
import { navigationRef, flushPendingReference } from './navigationRef'

// Deep links resolve against the renter tab set (AppTabs.js's RENTER_TABS) —
// the Explore stack owns PropertyDetail there.
// Both prefixes resolve to the same screens. The https one is only reachable
// once Android has VERIFIED the app against
// https://www.stayonmap.com/.well-known/assetlinks.json (app.config.js's
// intentFilters) — but it has to be listed here regardless, or a verified link
// launches the app and then lands on the default tab instead of the property,
// which looks like the deep link is broken when it is actually the router that
// never recognised the URL. WWW only: the apex redirect drops the path.
const linking = {
  prefixes: ['stayonmap://', 'https://www.stayonmap.com'],
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

  // Socket + live badge updates for every logged-in session. Above the
  // navigator so it survives every tab and mode swap — AppTabs remounts
  // wholesale when hostMode flips, and a listener living inside it would go
  // with it. Called before the loading gate below because hooks cannot be
  // conditional; it no-ops while `user` is null.
  useRealtimeUpdates()

  // Brand green, not white. On a cold start this gate is never SEEN —
  // BrandSplash waits on this same `loading` flag, so it is still opaque above
  // it and only lifts once this branch is gone. The colour is what keeps that
  // true if the two ever come apart (a splash that is skipped, an early
  // unmount): a white panel here would be a flash of exactly the blank screen
  // the launch sequence exists to avoid.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand600 }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} onReady={flushPendingReference}>
      {user ? <AppTabs /> : <AuthStack />}
      {/* Social-login deep-link listener + city-completion sheet. Lives at the
          root because the stayonmap://oauth-complete redirect can arrive
          logged-out (sign-in) or logged-in (linking from Settings). */}
      <OAuthRedirectHandler />
    </NavigationContainer>
  )
}
