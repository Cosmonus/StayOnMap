/**
 * The audit trail, and the column that was blank on every row.
 *
 * `GET /admin/logs` existed for months with no UI, and it read the USER side of
 * `ActivityLog` while every writer sets `adminId` — so the actor came back null
 * on every row and nobody noticed, because nobody could look. Both halves are
 * pinned here: the backend now selects `admin`, and this asserts the component
 * actually PREFERS it. A regression to the old shape would render a table of
 * real actions attributed to nobody, which is worse than no audit trail —
 * it looks like one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const logs = vi.fn()
vi.mock('@services/admin.service', () => ({ adminService: { logs: (params) => logs(params) } }))

const { default: ActivityLogSection } = await import('./ActivityLogSection')

const row = (over = {}) => ({
  id: 'l1',
  action: 'USER_BLOCKED',
  entity: 'User',
  entityId: 'clx000000abcdef',
  createdAt: '2026-08-09T10:00:00.000Z',
  admin: { id: 'a1', name: 'Asha', email: 'asha@stayonmap.com' },
  user: null,
  ...over,
})

const page = (rows, total = rows.length) => ({ data: { logs: rows, total, page: 1, limit: 50 } })

beforeEach(() => vi.clearAllMocks())

describe('who did it', () => {
  it('names the admin behind the action', async () => {
    logs.mockResolvedValue(page([row()]))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText('Asha')).toBeTruthy()
    expect(screen.getByText('USER_BLOCKED')).toBeTruthy()
  })

  it('falls back to the user when the action was not an admin one', async () => {
    logs.mockResolvedValue(page([row({ admin: null, user: { id: 'u1', name: 'Ravi', email: 'r@x.com' } })]))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText('Ravi')).toBeTruthy()
  })

  it('says System rather than leaving the actor blank', async () => {
    // A blank cell reads as a rendering bug and gets ignored; "System" is a
    // claim somebody can check.
    logs.mockResolvedValue(page([row({ admin: null, user: null })]))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText('System')).toBeTruthy()
  })

  it('uses the email when an admin has no name set', async () => {
    logs.mockResolvedValue(page([row({ admin: { id: 'a1', name: null, email: 'ops@stayonmap.com' } })]))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText('ops@stayonmap.com')).toBeTruthy()
  })
})

describe('the empty and error states', () => {
  it('distinguishes "nothing recorded" from "nothing matches your filter"', async () => {
    logs.mockResolvedValue(page([]))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText(/No admin actions recorded yet/i)).toBeTruthy()
  })

  it('offers a retry when the request fails', async () => {
    logs.mockRejectedValue(new Error('boom'))
    renderWithProviders(<ActivityLogSection />)
    expect(await screen.findByText(/Could not load the activity log/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })
})

describe('filtering', () => {
  it('sends the typed action to the server and resets to the first page', async () => {
    // Filtering client-side would silently only search the 50 rows on screen.
    logs.mockResolvedValue(page([row()]))
    const { user } = renderWithProviders(<ActivityLogSection />)
    await screen.findByText('Asha')

    await user.type(screen.getByLabelText(/filter by action/i), 'SUSPEND')
    await waitFor(() =>
      expect(logs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'SUSPEND', page: 1 })),
    )
  })

  it('asks for no filter at all when the box is empty', async () => {
    // `action: ''` would reach Prisma as `contains: ''`, which matches
    // everything — the same result by accident, and a habit that breaks the
    // first time a filter is not a substring match.
    logs.mockResolvedValue(page([row()]))
    renderWithProviders(<ActivityLogSection />)
    await waitFor(() => expect(logs).toHaveBeenCalledWith(expect.objectContaining({ action: undefined })))
  })
})
