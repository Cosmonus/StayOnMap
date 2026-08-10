/**
 * The access rules, exercised through the service rather than the pure module.
 *
 * support-visibility.test.js proves the RULES are right. This proves the
 * service actually applies them — which is a different claim, and the one that
 * matters, because a perfect visibility function is worthless if a read path
 * forgets to call it.
 *
 * Every test here is one of the spec's "MUST FAIL" scenarios:
 *   · a tenant reaching another tenant's case
 *   · an owner reaching the reporter's private conversation
 *   · an internal note leaving the building
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { getCaseForUser, addMessage, createCaseForUser } from '../src/features/support/supportCase.service.js'

const OWNER_ID = 'owner-2'
const REPORTER_ID = 'user-7'

/** A property-report case: reporter opened it, owner-2 owns the listing. */
const REPORT_CASE = {
  id: 'case-1', number: 7, type: 'PROPERTY_REPORT', status: 'OPEN',
  subject: 'Report: fraud', description: 'photos are reused',
  createdAt: new Date(), updatedAt: new Date(), resolvedAt: null, closedAt: null,
  createdById: REPORTER_ID, openedAs: 'TENANT',
  relatedUserId: OWNER_ID, relatedPropertyId: 'prop-1', relatedProperty: null,
  messages: [
    { id: 'm1', authorRole: 'TENANT', body: 'they asked me to pay before viewing', visibility: 'TENANT_ONLY', createdAt: new Date(), authorUser: { id: REPORTER_ID, name: 'Asha' }, attachments: [] },
    { id: 'm2', authorRole: 'ADMIN', body: 'This listing has three similar complaints.', visibility: 'INTERNAL', createdAt: new Date(), authorUser: null, attachments: [] },
    { id: 'm3', authorRole: 'OWNER', body: 'I never asked for money', visibility: 'OWNER_ONLY', createdAt: new Date(), authorUser: { id: OWNER_ID, name: 'Ravi' }, attachments: [] },
    { id: 'm4', authorRole: 'ADMIN', body: 'Thanks, we are looking into it.', visibility: 'PUBLIC', createdAt: new Date(), authorUser: null, attachments: [] },
  ],
  attachments: [
    { id: 'a1', url: 'https://x/tenant.png', fileName: 'chat.png', mimeType: 'image/png', visibility: 'TENANT_ONLY', messageId: 'm1' },
    { id: 'a2', url: 'https://x/internal.pdf', fileName: 'notes.pdf', mimeType: 'application/pdf', visibility: 'INTERNAL', messageId: null },
  ],
}

const bodies = (msgs) => msgs.map((m) => m.body)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.supportCase.findUnique.mockResolvedValue(REPORT_CASE)
  prismaMock.property.findUnique.mockResolvedValue({ ownerId: OWNER_ID })
  prismaMock.supportMessage.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.supportMessage.create.mockResolvedValue({ id: 'new', authorRole: 'TENANT', body: 'b', visibility: 'TENANT_ONLY', createdAt: new Date(), attachments: [] })
  prismaMock.supportCase.update.mockResolvedValue({})
})

describe('a stranger', () => {
  it('gets 404, not 403, for a case they are no party to', async () => {
    // "Not yours" and "does not exist" must be indistinguishable, or the id
    // becomes a way to enumerate other people's cases.
    await expect(getCaseForUser('case-1', 'stranger-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('cannot post into it either', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...REPORT_CASE, firstResponseAt: null })
    await expect(addMessage('case-1', { role: 'TENANT', userId: 'stranger-1' }, 'hello'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.supportMessage.create).not.toHaveBeenCalled()
  })
})

describe('the reporter', () => {
  it('sees their own words and the public reply', async () => {
    const res = await getCaseForUser('case-1', REPORTER_ID)
    expect(bodies(res.messages)).toEqual([
      'they asked me to pay before viewing',
      'Thanks, we are looking into it.',
    ])
  })

  it('never sees the internal note', async () => {
    const res = await getCaseForUser('case-1', REPORTER_ID)
    expect(JSON.stringify(res)).not.toMatch(/three similar complaints/)
  })

  it('never sees the owner’s response', async () => {
    // OWNER_ONLY cuts both ways — the owner's defence is not the reporter's
    // business any more than the reporter's words are the owner's.
    const res = await getCaseForUser('case-1', REPORTER_ID)
    expect(JSON.stringify(res)).not.toMatch(/never asked for money/)
  })

  it('is never told who they reported', async () => {
    // relatedUserId IS the owner's identity on a report.
    const res = await getCaseForUser('case-1', REPORTER_ID)
    expect(JSON.stringify(res)).not.toMatch(OWNER_ID)
  })
})

describe('the owner', () => {
  it('MUST NOT see the reporter’s private conversation', async () => {
    // The single most important assertion in the support layer.
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(JSON.stringify(res)).not.toMatch(/pay before viewing/)
  })

  it('MUST NOT learn who reported them', async () => {
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(JSON.stringify(res)).not.toMatch(REPORTER_ID)
    expect(JSON.stringify(res)).not.toMatch(/Asha/)
  })

  it('MUST NOT see the internal note', async () => {
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(JSON.stringify(res)).not.toMatch(/three similar complaints/)
  })

  it('sees their own response and the public reply', async () => {
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(bodies(res.messages)).toEqual(['I never asked for money', 'Thanks, we are looking into it.'])
  })

  it('never receives the reporter’s attachment', async () => {
    // A screenshot of a chat identifies the person who sent it, which is why
    // attachments carry visibility of their own rather than inheriting the
    // case's.
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(JSON.stringify(res)).not.toMatch(/tenant\.png/)
    expect(JSON.stringify(res)).not.toMatch(/notes\.pdf/)
  })
})

describe('an owner who filed the report themselves', () => {
  it('is treated as the TENANT on that case, not as an owner', async () => {
    // An owner reporting a rival's listing is acting as a renter. Reading them
    // as an owner would hand them the owner's side of a case filed against a
    // stranger — and here, their own listing's case.
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...REPORT_CASE, createdById: OWNER_ID })
    const res = await getCaseForUser('case-1', OWNER_ID)
    expect(res.viewerRole).toBe('TENANT')
    expect(JSON.stringify(res)).not.toMatch(/never asked for money/)
  })
})

describe('what a user may write', () => {
  it('clamps a tenant to TENANT_ONLY even when they ask for PUBLIC', () => {
    return addMessage('case-1', { role: 'TENANT', userId: REPORTER_ID }, 'hi', 'PUBLIC').then(() => {
      // Asking for PUBLIC on a report case is asking to publish your own
      // identity to the person you reported.
      expect(prismaMock.supportMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibility: 'TENANT_ONLY' }) }),
      )
    })
  })

  it('clamps a tenant asking for INTERNAL too', async () => {
    await addMessage('case-1', { role: 'TENANT', userId: REPORTER_ID }, 'hi', 'INTERNAL')
    expect(prismaMock.supportMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visibility: 'TENANT_ONLY' }) }),
    )
  })

  it('honours a staff choice, because that is what an internal note is', async () => {
    await addMessage('case-1', { role: 'ADMIN', adminId: 'admin-1' }, 'note', 'INTERNAL')
    expect(prismaMock.supportMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visibility: 'INTERNAL', authorAdminId: 'admin-1' }) }),
    )
  })

  it('refuses to write into a closed case', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...REPORT_CASE, status: 'CLOSED' })
    await expect(addMessage('case-1', { role: 'TENANT', userId: REPORTER_ID }, 'hi'))
      .rejects.toMatchObject({ statusCode: 400, expose: true })
  })
})

describe('related references on a new case', () => {
  it('drops an appointment that is not the caller’s', async () => {
    // The attack: attach a stranger's appointment to your own case and read
    // the admin's replies about it. Dropped rather than rejected — the support
    // request is still valid and a person asking for help should not meet a
    // validation error about plumbing they never saw.
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.conversation.findFirst.mockResolvedValue(null)
    prismaMock.lease.findFirst.mockResolvedValue(null)

    await createCaseForUser('user-1', {
      type: 'APPOINTMENT_ISSUE', subject: 's', description: 'd'.repeat(25),
      relatedAppointmentId: 'someone-elses', relatedConversationId: 'also-theirs',
    })

    expect(prismaMock.supportCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relatedAppointmentId: null, relatedConversationId: null }),
      }),
    )
  })

  it('keeps one the caller is a party to', async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: 'appt-9' })
    prismaMock.conversation.findFirst.mockResolvedValue(null)
    prismaMock.lease.findFirst.mockResolvedValue(null)

    await createCaseForUser('user-1', {
      type: 'APPOINTMENT_ISSUE', subject: 's', description: 'd'.repeat(25),
      relatedAppointmentId: 'appt-9',
    })

    expect(prismaMock.supportCase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relatedAppointmentId: 'appt-9' }) }),
    )
  })
})
