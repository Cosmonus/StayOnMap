/**
 * Signing out takes the previous account's data with it.
 *
 * `signOut` already dropped the tokens and the local listing draft, and the
 * comment on the draft states the reason exactly: leaving it "would hand the
 * next person to sign in on a shared machine a stranger's half-written
 * listing". Every cached SERVER query was left in place anyway.
 *
 * React Query's cache is keyed by query, not by account. So on a shared
 * machine the next person inherited the last one's profile, unread counts,
 * notifications, leases and saved homes until each key happened to refetch.
 *
 * `['me']` is the one that bites hardest, because it is an AUTHORISATION
 * input: `isOwner` derives from it, and the host dashboard's render gate reads
 * that. A fresh TENANT signing in after an owner inherited `role: 'OWNER'`,
 * mounted the host dashboard, and got a 403 rendered as "We couldn't load your
 * dashboard" with a Retry that could never succeed — the 2026-08-07 bug 4
 * report. The dashboard was never the problem.
 *
 * This is a privacy boundary and it fails INVISIBLY: nothing errors, the next
 * user simply sees someone else's numbers for a while.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@services/auth.service', () => ({
  authService: {
    getMe: vi.fn().mockResolvedValue({ data: null }),
    logout: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@components/common/Toaster', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@features/listings/components/onboarding/draftSync', () => ({
  clearLocalDraftOnSignOut: vi.fn(),
}))

const { AuthProvider, useAuth } = await import('./AuthContext')
const { clearLocalDraftOnSignOut } = await import('@features/listings/components/onboarding/draftSync')

function setup() {
  // A client with REAL garbage-collection settings, not the shared test helper.
  // That helper sets `gcTime: 0`, which drops an unobserved entry immediately —
  // so `getQueryData` returned undefined whether or not sign-out cleared
  // anything, and three of the four assertions below passed against the broken
  // code. A test that cannot fail is worse than no test: it reports safety.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 5 * 60 * 1000 } },
  })
  // Data the previous account left behind, of exactly the kinds that survive.
  client.setQueryData(['me'], { id: 'owner-1', role: 'OWNER', name: 'Previous Owner' })
  client.setQueryData(['chat-unread'], { count: 7 })
  client.setQueryData(['saved'], [{ id: 'someone-elses-home' }])

  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
  const { result } = renderHook(() => useAuth(), { wrapper })
  return { client, result }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('signOut', () => {
  it('leaves no trace of the previous account in the query cache', async () => {
    const { client, result } = setup()
    expect(client.getQueryData(['me'])).toBeTruthy() // precondition

    await act(async () => { result.current.signOut() })

    for (const key of [['me'], ['chat-unread'], ['saved']]) {
      expect(client.getQueryData(key)).toBeUndefined()
    }
  })

  // The specific carrier of bug 4. `role` is an authorisation input, and a
  // stale OWNER is what mounted the host dashboard for a tenant.
  it('does not leave a stale role behind for the next account', async () => {
    const { client, result } = setup()
    await act(async () => { result.current.signOut() })

    expect(client.getQueryData(['me'])?.role).toBeUndefined()
  })

  // clear(), not invalidate: invalidation keeps serving the stale value while
  // it refetches, which is precisely the window the bug lived in.
  it('removes the data rather than marking it stale', async () => {
    const { client, result } = setup()
    await act(async () => { result.current.signOut() })

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })

  it('still drops the tokens and the local draft', async () => {
    localStorage.setItem('user_token', 't')
    localStorage.setItem('user_refresh_token', 'r')
    const { result } = setup()

    await act(async () => { result.current.signOut() })

    expect(localStorage.getItem('user_token')).toBeNull()
    expect(localStorage.getItem('user_refresh_token')).toBeNull()
    expect(clearLocalDraftOnSignOut).toHaveBeenCalled()
  })
})
