import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { useUiStore } from '@store/uiStore'
import { clearLocalDraftOnSignOut } from '@features/listings/components/onboarding/draftSync'

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
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function loginSuccess({ token, refreshToken, user: loggedInUser }) {
    localStorage.setItem('user_token', token)
    if (refreshToken) localStorage.setItem('user_refresh_token', refreshToken)
    setUser(loggedInUser)
    // The chosen view survives logout (operator decision 2026-07-27) — but it
    // belongs to the PERSON, so it's reconciled against whoever just signed
    // in: a non-owner account never lands in a host shell it can't use.
    if (loggedInUser.role !== 'OWNER') useUiStore.getState().setHostMode(false)
    toast.success('Welcome', `Signed in as ${loggedInUser.name || loggedInUser.email}`)
  }

  function signOut() {
    // Revoke this device's session server-side — best-effort, the tokens are
    // being dropped locally either way. hostMode deliberately survives: a host
    // who logs back in should be back in host view, not silently demoted —
    // only the explicit "Switch to tenant" changes the view.
    const refreshToken = localStorage.getItem('user_refresh_token')
    if (refreshToken) authService.logout({ refreshToken }).catch(() => {})
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_refresh_token')
    // The unfinished listing goes with them. It is kept server-side now, so
    // nothing is lost by dropping this browser's copy — and leaving it would
    // hand the next person to sign in on a shared machine a stranger's
    // half-written listing, which is exactly how it behaved before the draft
    // belonged to an account.
    clearLocalDraftOnSignOut()
    setUser(null)
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
