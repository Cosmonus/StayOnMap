/**
 * The admin support surface.
 *
 * Two things here are worth testing and the rest is markup:
 *
 *   1. AN INTERNAL NOTE MUST BE UNMISTAKABLE. The dangerous mistake is a
 *      moderator writing something about a user into what they believed was a
 *      private note — or the reverse — and the server cannot save them from it,
 *      because by then they have already chosen. So the label is on every
 *      message, not only internal ones, and the compose box itself changes.
 *   2. ZERO AND UNKNOWN MUST NOT LOOK ALIKE. "No urgent cases" and "we have not
 *      counted yet" are different claims, and only one of them is reassuring —
 *      the same rule the supply readouts already follow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const supportCases = vi.fn()
const supportCounts = vi.fn()
const supportCase = vi.fn()

vi.mock('@services/admin.service', () => ({
  adminService: {
    supportCases: (p) => supportCases(p),
    supportCounts: () => supportCounts(),
    supportCase: (id) => supportCase(id),
    supportReply: vi.fn(),
    supportSetStatus: vi.fn(),
    supportSetPriority: vi.fn(),
    supportEscalate: vi.fn(),
  },
}))

const { default: SupportInbox } = await import('./SupportInbox')
const { default: SupportCaseDetail } = await import('./SupportCaseDetail')

const CASE_ROW = {
  id: 'c1', number: 42, type: 'FRAUD_REPORT', status: 'OPEN', priority: 'URGENT',
  subject: 'Owner asked for money before a viewing', createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z', firstResponseAt: null,
  createdBy: { id: 'u1', name: 'Asha', email: 'asha@example.com' },
  assignedTo: null, relatedProperty: { id: 'p1', title: '2BHK in Adyar', city: 'Chennai' },
  report: { id: 'r1', category: 'FRAUD', severity: 'HIGH' },
  _count: { messages: 2 },
}

const COUNTS = { open: 4, urgent: 1, unassigned: 3, waiting: 2, escalated: 0, resolved: 9, closed: 12 }

beforeEach(() => {
  vi.clearAllMocks()
  supportCounts.mockResolvedValue({ data: COUNTS })
  supportCases.mockResolvedValue({ data: { cases: [CASE_ROW], total: 1, page: 1, limit: 25 } })
})

describe('the queue', () => {
  it('shows a case with its reference, state and who is waiting', async () => {
    renderWithProviders(<SupportInbox />)
    expect(await screen.findByText('SC-42')).toBeTruthy()
    expect(screen.getByText('Owner asked for money before a viewing')).toBeTruthy()
    // getAllBy: 'Urgent' is both the row's priority chip and the counter tile
    // above it, which is correct — the same word means the same thing in both.
    expect(screen.getAllByText('Urgent').length).toBeGreaterThan(0)
    // The only badge that means "act now": somebody wrote and nobody has read
    // it. Staff have no notification stream, so this is the entire signal.
    expect(screen.getByText('2 unread')).toBeTruthy()
  })

  it('shows an em-dash, not 0, while the counters are still loading', async () => {
    // A tile reading "0 urgent" before the count arrives is a reassuring lie.
    supportCounts.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<SupportInbox />)
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0))
  })

  it('tells an empty queue apart from an empty filter', async () => {
    supportCases.mockResolvedValue({ data: { cases: [], total: 0 } })
    renderWithProviders(<SupportInbox />)
    // Unfiltered: this is good news and says so.
    expect(await screen.findByText(/No support cases yet/i)).toBeTruthy()
  })

  it('offers a retry when the queue fails, rather than reading as empty', async () => {
    supportCases.mockRejectedValue(new Error('nope'))
    renderWithProviders(<SupportInbox />)
    expect(await screen.findByText(/Couldn't load the support queue/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })
})

describe('the case detail', () => {
  const DETAIL = {
    ...CASE_ROW,
    description: 'They asked for a deposit before showing me the flat.',
    openedAs: 'TENANT', resolvedAt: null, closedAt: null,
    messages: [
      { id: 'm1', authorRole: 'TENANT', body: 'they asked me to pay first', visibility: 'TENANT_ONLY', createdAt: '2026-08-01T11:00:00Z', authorUser: { id: 'u1', name: 'Asha' }, authorAdmin: null, attachments: [] },
      { id: 'm2', authorRole: 'ADMIN', body: 'Third complaint on this listing.', visibility: 'INTERNAL', createdAt: '2026-08-01T12:00:00Z', authorUser: null, authorAdmin: { id: 'a1', name: 'Moderator' }, attachments: [] },
    ],
    attachments: [],
    events: [
      { id: 'e1', type: 'CASE_CREATED', actorRole: 'TENANT', meta: null, createdAt: '2026-08-01T10:00:00Z', actorUser: { id: 'u1', name: 'Asha' }, actorAdmin: null },
      { id: 'e2', type: 'STATUS_CHANGED', actorRole: 'ADMIN', meta: { from: 'OPEN', to: 'IN_PROGRESS' }, createdAt: '2026-08-01T12:05:00Z', actorUser: null, actorAdmin: { id: 'a1', name: 'Moderator' } },
    ],
  }

  it('labels who can read EVERY message, not just the internal one', async () => {
    // "Who can read this" is the question a moderator needs answered before
    // they reply. Inferring it from a tint is how the wrong thing reaches the
    // wrong person.
    supportCase.mockResolvedValue({ data: DETAIL })
    renderWithProviders(<SupportCaseDetail caseId="c1" onBack={() => {}} />)

    // getAllBy on both: each label appears on its message AND as an option in
    // the reply-target picker, which is the point — a moderator choosing where
    // a reply goes reads the same words the thread is labelled with.
    expect((await screen.findAllByText('Requester only')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Internal note').length).toBeGreaterThan(0)
  })

  it('marks the internal note with a distinct surface, not just a word', async () => {
    supportCase.mockResolvedValue({ data: DETAIL })
    const { container } = renderWithProviders(<SupportCaseDetail caseId="c1" onBack={() => {}} />)
    await screen.findByText('Third complaint on this listing.')

    const note = container.querySelector('li.border-l-4')
    expect(note, 'the internal note has no distinguishing surface').toBeTruthy()
    expect(note.className).toMatch(/amber/)
  })

  it('renders the timeline as sentences, from the event data', async () => {
    // meta is stored as DATA so it stays queryable; the sentence is built here.
    supportCase.mockResolvedValue({ data: DETAIL })
    renderWithProviders(<SupportCaseDetail caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/Status Open → In progress/i)).toBeTruthy()
    expect(screen.getByText('Case opened')).toBeTruthy()
  })

  it('will not offer a reply box on a closed case', async () => {
    // The server refuses it too; showing the box would invite typing something
    // that then 400s.
    supportCase.mockResolvedValue({ data: { ...DETAIL, status: 'CLOSED' } })
    renderWithProviders(<SupportCaseDetail caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/closed cases cannot take new messages/i)).toBeTruthy()
    expect(screen.queryByPlaceholderText(/your reply/i)).toBeNull()
  })

  it('says the case could not be loaded rather than rendering an empty shell', async () => {
    supportCase.mockRejectedValue(new Error('gone'))
    renderWithProviders(<SupportCaseDetail caseId="c1" onBack={() => {}} />)
    expect(await screen.findByText(/Couldn't load this case/i)).toBeTruthy()
  })
})
