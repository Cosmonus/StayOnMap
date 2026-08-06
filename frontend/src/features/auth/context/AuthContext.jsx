import { createContext, useContext, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { useUiStore } from '@store/uiStore'
import { clearLocalDraftOnSignOut } from '@features/listings/components/onboarding/draftSync'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  // AuthProvider sits INSIDE QueryClientProvider (main.jsx), so this is the
  // same client every query uses.
  const queryClient = useQueryClient()

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
    // Every SERVER query goes with them too, for exactly the reason stated
    // above about the draft — and this was the half that was missing.
    //
    // React Query's cache is keyed by query, not by account. Without this, the
    // next person to sign in on this machine gets served the previous user's
    // cached data until each key happens to refetch: their profile, their
    // unread counts, their notifications, their leases, their saved homes.
    //
    // `['me']` is the one that bites hardest, because it is an AUTHORISATION
    // input. `isOwner` is derived from it, and `HostDashboard`'s render gate
    // reads that — so a fresh TENANT signing in after an owner inherited
    // `role: 'OWNER'`, mounted the host dashboard, and got a 403 rendered as
    // "We couldn't load your dashboard" with a Retry that could never work.
    // That is the 2026-08-07 bug 4 report, and the stale cache is its root
    // cause rather than anything in the dashboard itself.
    //
    // clear(), not invalidate: invalidation keeps the stale value on screen
    // while it refetches, which is the whole problem.
    queryClient.clear()
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
