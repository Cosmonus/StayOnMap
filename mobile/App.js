import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import { useFonts } from 'expo-font'
import { queryClient } from '@lib/queryClient'
import { getSocket } from '@lib/socket'
import { AuthProvider } from '@features/auth/context/AuthContext'
import BrandSplash from '@components/common/BrandSplash'
import RootNavigator from '@navigation/RootNavigator'
import { navigateToReference } from '@navigation/navigationRef'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  // The branded launch screen (the wordmark, on the same brand green the
  // native splash just painted) that takes over the instant that splash lets
  // go. It is an overlay, not a route: the navigator mounts and starts its own
  // data fetching underneath while it plays, so the brand moment costs nothing
  // in time-to-interactive.
  //
  // It leaves as soon as the session is rehydrated — see BrandSplash. It used
  // to run a fixed 1220ms and had no idea what the app was doing, which was
  // wrong in both directions: it sat there after the app was ready, and on a
  // slow /auth/me it left too early and handed over to RootNavigator's
  // loading gate. One green screen that waits for real work beats two that
  // take turns.
  const [brandSplashDone, setBrandSplashDone] = useState(false)
  const finishBrandSplash = useCallback(() => setBrandSplashDone(true), [])

  // require() the 5 weight files directly — importing from the package index
  // made Metro bundle every weight in both families (~27 TTFs, several MB of
  // APK for fonts nothing renders). Keys must match theme/typography.js.
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold: require('@expo-google-fonts/sora/600SemiBold/Sora_600SemiBold.ttf'),
    Sora_700Bold: require('@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf'),
    Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) navigateToReference(response.notification.request.content.data ?? {})
      })
      .catch(() => {})
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToReference(response.notification.request.content.data ?? {})
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const socket = getSocket()
      if (socket && !socket.connected) socket.connect()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
    return () => sub.remove()
  }, [])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
            {/* Inside AuthProvider so it can read `loading` and stay up for
                exactly as long as the session takes to rehydrate. Still the
                last sibling, so it paints above the navigator without a Modal
                — a Modal here would fight the status bar and the hardware
                back handler. */}
            {!brandSplashDone && <BrandSplash onFinish={finishBrandSplash} />}
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
