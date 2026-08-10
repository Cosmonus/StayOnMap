/**
 * Help & Support, from the user's side.
 *
 * The properties worth pinning are about WORDS and about what is offered when:
 *
 *   1. The status copy is the user's, not our queue's. `WAITING_FOR_USER` is
 *      accurate from the inside and useless from the outside — the person
 *      waiting needs to read "we need something from you".
 *   2. Closing is offered only once WE have said it is resolved. A Close button
 *      on an unanswered request is an invitation to give up.
 *   3. Reporting a listing is NOT offered here. That path runs the risk score
 *      and the auto-suspend rule and needs to know which listing; a second door
 *      with none of that would be worse than no door.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const listCases = vi.fn()
const getCase = vi.fn()
const articles = vi.fn()

// The render helper deliberately provides no AuthProvider — "where the
// component reads auth, a stub context supplied by the test itself". The user
// id is what decides which bubbles read as yours.
vi.mock('@features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Asha' }, loading: false }),
}))

vi.mock('@services/support.service', () => ({
  supportService: {
    listCases: (h) => listCases(h),
    getCase: (id) => getCase(id),
    articles: (p) => articles(p),
    createCase: vi.fn(),
    reply: vi.fn(),
    close: vi.fn(),
  },
}))

const { default: SupportCenter } = await import('./SupportCenter')
const { default: SupportCaseView } = await import('./SupportCaseView')
const { TENANT_CATEGORIES, OWNER_CATEGORIES } = await import('./supportCopy')

const CASE = {
  id: 'c1', number: 12, type: 'LISTING_ISSUE', status: 'WAITING_FOR_USER',
  subject: 'The photos do not match the flat', createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-02T10:00:00Z', _count: { messages: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  listCases.mockResolvedValue({ data: [CASE] })
  articles.mockResolvedValue({ data: { categories: [], articles: [] } })
})

describe('the request list', () => {
  it('states the status in the reader’s words, not the queue’s', async () => {
    renderWithProviders(<SupportCenter />)
    expect(await screen.findByText('We need something from you')).toBeTruthy()
    // Our internal vocabulary must never reach a user.
    expect(screen.queryByText(/WAITING_FOR_USER/)).toBeNull()
  })

  it('flags a reply the reader has not seen', async () => {
    renderWithProviders(<SupportCenter />)
    expect(await screen.findByText('New reply')).toBeTruthy()
  })

  it('says nothing is open rather than showing a blank panel', async () => {
    listCases.mockResolvedValue({ data: [] })
    renderWithProviders(<SupportCenter />)
    expect(await screen.findByText('Nothing open')).toBeTruthy()
  })

  it('offers a retry when the list fails, so a failure is not read as "no requests"', async () => {
    listCases.mockRejectedValue(new Error('nope'))
    renderWithProviders(<SupportCenter />)
    expect(await screen.findByText(/Couldn't load your requests/i)).toBeTruthy()
  })

  it('shows help articles above the requests', async () => {
    // The cheapest support request is the one nobody needed to send.
    articles.mockResolvedValue({
      data: { categories: [], articles: [{ id: 'a1', title: 'What "lease" means', body: 'A lump sum.', category: { title: 'Money' } }] },
    })
    renderWithProviders(<SupportCenter />)
    expect(await screen.findByText('What "lease" means')).toBeTruthy()
  })
})

describe('what a user may open a request about', () => {
  it('never offers "report a listing" as a support category', () => {
    // Reporting runs the risk score, the auto-suspend corroboration rule and
    // the owner notification, and needs to know WHICH listing. A support case
    // created here would skip all of it.
    for (const list of [TENANT_CATEGORIES, OWNER_CATEGORIES]) {
      expect(list).not.toContain('PROPERTY_REPORT')
    }
  })

  it('offers each hat the problems it can actually have', () => {
    // A renter has no verification to ask about; an owner is not chasing a
    // visit they requested of themselves.
    expect(OWNER_CATEGORIES).toContain('OWNER_VERIFICATION')
    expect(TENANT_CATEGORIES).not.toContain('OWNER_VERIFICATION')
    expect(TENANT_CATEGORIES).toContain('SAFETY_REPORT')
  })
})

describe('one request', () => {
  const DETAIL = {
    ...CASE,
    description: 'The listing shows a balcony and there is none.',
    messages: [
      { id: 'm1', authorRole: 'TENANT', body: 'Photos are wrong', createdAt: '2026-08-01T11:00:00Z', authorUser: { id: 'u1', name: 'Asha' } },
      { id: 'm2', authorRole: 'ADMIN', body: 'Thanks — which listing?', createdAt: '2026-08-01T12:00:00Z', authorUser: null },
    ],
  }

  it('names staff as StayOnMap, never as a person', async () => {
    // Which moderator handled a case is not something a user needs, and is
    // something a determined person could act on.
    getCase.mockResolvedValue({ data: DETAIL })
    renderWithProviders(<SupportCaseView caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/StayOnMap ·/)).toBeTruthy()
  })

  it('does not offer to close a request support has not resolved', async () => {
    getCase.mockResolvedValue({ data: DETAIL })
    renderWithProviders(<SupportCaseView caseId="c1" onBack={() => {}} />)
    await screen.findByText('Thanks — which listing?')
    expect(screen.queryByText(/that fixed it/i)).toBeNull()
  })

  it('offers to close one that IS resolved', async () => {
    // Confirming a resolution is the requester's business; deciding a case is
    // resolved is not.
    getCase.mockResolvedValue({ data: { ...DETAIL, status: 'RESOLVED' } })
    renderWithProviders(<SupportCaseView caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/that fixed it/i)).toBeTruthy()
  })

  it('takes no new messages on a closed request', async () => {
    getCase.mockResolvedValue({ data: { ...DETAIL, status: 'CLOSED' } })
    renderWithProviders(<SupportCaseView caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/this request is closed/i)).toBeTruthy()
    expect(screen.queryByPlaceholderText(/anything else/i)).toBeNull()
  })

  it('says a request could not be opened rather than rendering an empty one', async () => {
    getCase.mockRejectedValue(new Error('gone'))
    renderWithProviders(<SupportCaseView caseId="c1" onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Couldn't open this request/i)).toBeTruthy())
  })
})
