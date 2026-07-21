import { createContext, useContext, useState, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authService } from '@services/auth.service'
import { connectSocket, disconnectSocket } from '@lib/socket'
import {
  registerForPushNotifications,
  registerForPushNotificationsIfGranted,
  unregisterPushNotifications,
} from '@services/push.service'
import { useUiStore, HOST_MODE_KEY } from '@store/uiStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)

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
        useUiStore.getState().setHostMode(false)
      })
      .finally(() => setLoading(false))
  }, [])

  async function loginSuccess({ token, refreshToken, user: loggedInUser }) {
    await AsyncStorage.setItem('user_token', token)
    // Older backend responses have no refreshToken — sessions are additive.
    if (refreshToken) await AsyncStorage.setItem('user_refresh_token', refreshToken)
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
    const refreshToken = await AsyncStorage.getItem('user_refresh_token').catch(() => null)
    if (refreshToken) {
      authService.logout({ refreshToken }).catch(() => {})
      await AsyncStorage.removeItem('user_refresh_token')
    }
    await AsyncStorage.removeItem('user_token')
    setUser(null)
    hadUser.current = false
    useUiStore.getState().setHostMode(false)
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
