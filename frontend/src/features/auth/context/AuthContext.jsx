import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { useUiStore } from '@store/uiStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (!token) { setLoading(false); return }

    authService.getMe()
      .then((res) => setUser(res.data))
      .catch((err) => {
        // Only a genuine auth failure clears the session. A transient error —
        // a 429 (rate limit), a 5xx, or a network blip — must NOT log the user
        // out: dropping the token here on a 429 from /auth/me was exactly how a
        // rate-limited page load ejected a signed-in user. The axios
        // interceptor already handles 401 refresh; leave the token in place for
        // anything else and let the next check recover.
        if (err?.statusCode === 401 || err?.statusCode === 403) {
          localStorage.removeItem('user_token')
          useUiStore.getState().setHostMode(false)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function loginSuccess({ token, refreshToken, user: loggedInUser }) {
    localStorage.setItem('user_token', token)
    if (refreshToken) localStorage.setItem('user_refresh_token', refreshToken)
    setUser(loggedInUser)
    toast.success('Welcome', `Signed in as ${loggedInUser.name || loggedInUser.email}`)
  }

  function signOut() {
    // Revoke this device's session server-side — best-effort, the tokens are
    // being dropped locally either way.
    const refreshToken = localStorage.getItem('user_refresh_token')
    if (refreshToken) authService.logout({ refreshToken }).catch(() => {})
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_refresh_token')
    setUser(null)
    useUiStore.getState().setHostMode(false)
    toast.info('Signed out', 'You have been logged out')
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
