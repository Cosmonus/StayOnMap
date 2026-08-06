/**
 * A 403 is not a broken screen.
 *
 * `GET /host/dashboard` is `authMiddleware + requireOwner`. Mobile shipped this
 * bug and fixed it on 2026-08-01 (PR #170); web was believed safe because
 * `DashboardPage` renders this component only when `hostMode && isOwner`.
 * A user hit it on web anyway, and the reason is that `isOwner` is read from
 * the SHARED `['me']` React Query cache — which is never cleared on sign-out
 * and is served stale-while-revalidate. When that cache says OWNER and the
 * server says TENANT, the render-site guard passes, the owner-only query fires,
 * and the 403 rendered as "We couldn't load your dashboard" with a Retry that
 * could never succeed. A failing `/auth/me` refetch (a 429 off `/auth`'s
 * strictLimiter is enough) makes it permanent instead of a flash.
 *
 * So the component guards itself twice, and both halves are pinned here:
 * the query does not go out for a known non-owner, and OWNER_REQUIRED coming
 * back is the server telling us the client's role was wrong.
 *
 * `backend/tests/role-gated-queries.test.js` pins the STATIC half of the same
 * rule — that an `enabled` on an owner-only endpoint gates on the role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, makeQueryClient } from '@/test/render'

const getMe = vi.fn()
const dashboard = vi.fn()

vi.mock('@services/auth.service', () => ({ authService: { getMe: () => getMe() } }))
vi.mock('@services/host.service', () => ({ hostService: { dashboard: () => dashboard() } }))
vi.mock('@services/appointment.service', () => ({ appointmentService: { updateStatus: vi.fn() } }))
vi.mock('@services/review.service', () => ({ reviewService: { respond: vi.fn() } }))
vi.mock('@components/common/Toaster', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { default: HostDashboard } = await import('./HostDashboard')

// What requireOwner actually sends: no `statusCode` field, only the code.
const OWNER_REQUIRED = { success: false, error: 'OWNER_REQUIRED', message: 'Only owners can perform this action' }

const EMPTY_DASHBOARD = { needsYouToday: [], last30Days: { windowDays: 30 } }

beforeEach(() => {
  vi.clearAllMocks()
  dashboard.mockRejectedValue(OWNER_REQUIRED)
})

describe('host dashboard — role gate', () => {
  it('never asks for a tenant’s dashboard, and offers the listing they have not made', async () => {
    getMe.mockResolvedValue({ data: { id: 'u1', role: 'TENANT' } })
    renderWithProviders(<HostDashboard onAddListing={vi.fn()} />)

    expect(await screen.findByText(/haven.t listed anything yet/i)).toBeInTheDocument()
    expect(dashboard).not.toHaveBeenCalled()
    expect(screen.queryByText(/couldn.t load your dashboard/i)).not.toBeInTheDocument()
  })

  it('a stale OWNER profile does not survive the server saying otherwise', async () => {
    // The reported shape: the cache holds the previous account's OWNER profile
    // and /auth/me cannot correct it (429), so the render-site guard lets us in.
    const client = makeQueryClient()
    client.setQueryData(['me'], { id: 'uPrev', role: 'OWNER' })
    getMe.mockRejectedValue({ success: false, message: 'Too many requests', statusCode: 429 })

    renderWithProviders(<HostDashboard onAddListing={vi.fn()} />, { client })

    expect(await screen.findByText(/haven.t listed anything yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/couldn.t load your dashboard/i)).not.toBeInTheDocument()
  })

  it('still shows a real failure as a failure', async () => {
    getMe.mockResolvedValue({ data: { id: 'u1', role: 'OWNER' } })
    dashboard.mockRejectedValue({ success: false, error: 'INTERNAL', statusCode: 500 })
    renderWithProviders(<HostDashboard onAddListing={vi.fn()} />)

    expect(await screen.findByText(/couldn.t load your dashboard/i)).toBeInTheDocument()
  })

  it('an owner gets their dashboard', async () => {
    getMe.mockResolvedValue({ data: { id: 'u1', role: 'OWNER' } })
    dashboard.mockResolvedValue({ data: EMPTY_DASHBOARD })
    renderWithProviders(<HostDashboard onAddListing={vi.fn()} />)

    expect(await screen.findByText('Hosting')).toBeInTheDocument()
    await waitFor(() => expect(dashboard).toHaveBeenCalled())
  })
})
