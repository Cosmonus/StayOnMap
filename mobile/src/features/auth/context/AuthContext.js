import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authService } from '@services/auth.service'
import { connectSocket, disconnectSocket } from '@lib/socket'
import {
  registerForPushNotifications,
  registerForPushNotificationsIfGranted,
  unregisterPushNotifications,
} from '@services/push.service'
import { useUiStore, HOST_MODE_KEY } from '@store/uiStore'
import { clearLocalDraftOnSignOut } from '@features/listings/components/onboarding/draftSync'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)
  // AuthProvider sits inside QueryClientProvider (App.js), so this is the same
  // client every query uses.
  const queryClient = useQueryClient()

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('user_token'), AsyncStorage.getItem(HOST_MODE_KEY)])
      .then(([token, hostMode]) => {
        useUiStore.getState()._setHostModeSilent(hostMode === 'true')
        if (!token) return null
        return authService.getMe().then((res) => {
          setUser(res.data)
          hadUser.current = true
          connectSocket()
          registerForPushNotificationsIfGranted().catch(() => {})
        })
      })
      .catch(() => {
        AsyncStorage.removeItem('user_token')
      })
      .finally(() => setLoading(false))
  }, [])

  async function loginSuccess({ token, refreshToken, user: loggedInUser }) {
    await AsyncStorage.setItem('user_token', token)
    // Older backend responses have no refreshToken — sessions are additive.
    if (refreshToken) await AsyncStorage.setItem('user_refresh_token', refreshToken)
    // The chosen mode survives logout (2026-07-27) but belongs to the person:
    // a non-owner account signing in on this device never lands in host tabs.
    // For an owner in host mode, AppTabs mounts HOST_TABS → Dashboard first;
    // renter mode mounts RENTER_TABS → Explore (the map) first.
    if (loggedInUser.role !== 'OWNER') useUiStore.getState().setHostMode(false)
    setUser(loggedInUser)
    if (!hadUser.current) {
      connectSocket()
      registerForPushNotifications().catch(() => {})
    }
    hadUser.current = true
  }

  async function signOut() {
    // Revoke this device's session server-side — best-effort; the local
    // tokens are gone either way.
    // Before the tokens go: the unfinished listing is kept server-side now, so
    // nothing is lost by dropping this phone's copy — and leaving it would hand
    // the next person to sign in on this device a stranger's half-written
    // listing, which is how it behaved before the draft belonged to an account.
    await clearLocalDraftOnSignOut()

    const refreshToken = await AsyncStorage.getItem('user_refresh_token').catch(() => null)
    if (refreshToken) {
      authService.logout({ refreshToken }).catch(() => {})
      await AsyncStorage.removeItem('user_refresh_token')
    }
    await AsyncStorage.removeItem('user_token')
    // Every SERVER query goes with them, for the same reason the local draft
    // above does. React Query's cache is keyed by query, not by account, so
    // without this the next person to sign in on this phone is served the
    // previous user's data until each key happens to refetch: their profile,
    // unread counts, notifications, leases, saved homes.
    //
    // `['me']` matters most because it is an AUTHORISATION input — `role` is
    // read from it to decide which mode and which screens a person gets. Web
    // had the identical hole and it is what produced the "couldn't load your
    // dashboard" report on 2026-08-07.
    //
    // clear(), not invalidate: invalidation keeps serving the stale value while
    // it refetches, which is the window the bug lives in.
    queryClient.clear()
    setUser(null)
    hadUser.current = false
    // hostMode deliberately survives sign-out — a host logging back in lands
    // back in host view; only the explicit mode switch changes it.
    unregisterPushNotifications().catch(() => {})
    disconnectSocket()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, loginSuccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
