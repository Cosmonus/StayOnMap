/**
 * The conversation on a report — reporter ↔ moderator, and nobody else.
 *
 * Built 2026-08-10 to finish closing the silence around reporting. Outcome
 * notifications told a reporter what was decided; this is the other half, which
 * is a moderator being able to ask "which listing, what exactly happened" and a
 * reporter being able to answer.
 *
 * Three properties carry the whole design, and two of them are about who is NOT
 * in the room:
 *
 *   1. THE OWNER IS NEVER A PARTY. Reports can be anonymous and the owner
 *      already cannot see who filed one; a thread the owner could read would
 *      undo that in the most direct way available.
 *   2. A REPORT ID IS NOT A KEY. It reaches the client in a notification
 *      payload, so the reporter side must be scoped by reporterId on every
 *      call — and must answer 404, not 403, or the id becomes a probe.
 *   3. An anonymous report has nobody to reply TO, and a reply box that
 *      silently discards what a moderator typed is worse than no reply box.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { notifyUser } from '../src/features/notifications/notifications.service.js'
import {
  getThreadForReporter, addReporterMessage,
  getThreadForAdmin, addAdminMessage, reportsAwaitingModerator,
} from '../src/features/reports/reportThread.service.js'

// A report now carries a supportCaseId — the storage moved to SupportMessage
// on 2026-08-10 and this file's assertions moved with it. Every BEHAVIOURAL
// assertion below is unchanged; only the mocks and the two that reached into
// the old table's column names were rewritten.
const MINE = { id: 'rep-1', reporterId: 'user-7', category: 'FRAUD', status: 'PENDING', propertyId: 'prop-1', createdAt: new Date(), supportCaseId: 'case-1' }

/** The case getCaseForUser loads when the reporter opens their thread. */
const CASE_FOR_MINE = {
  id: 'case-1', number: 7, type: 'PROPERTY_REPORT', status: 'OPEN', subject: 'Report: fraud',
  description: 'd', createdAt: new Date(), updatedAt: new Date(), resolvedAt: null, closedAt: null,
  createdById: 'user-7', openedAs: 'TENANT', relatedUserId: null, relatedPropertyId: 'prop-1',
  relatedProperty: null, messages: [], attachments: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.supportMessage.findMany.mockResolvedValue([])
  prismaMock.supportMessage.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.supportMessage.create.mockResolvedValue({ id: 'msg-1', authorRole: 'ADMIN', body: 'b', createdAt: new Date(), attachments: [] })
  prismaMock.supportCase.findUnique.mockResolvedValue(CASE_FOR_MINE)
  prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-2' })
})

describe('a reporter reading their own thread', () => {
  it('scopes the lookup by reporterId — the ownership check IS the query', async () => {
    prismaMock.propertyReport.findFirst.mockResolvedValue(MINE)
    await getThreadForReporter('rep-1', 'user-7')

    // findFirst with BOTH ids, never findUnique-then-compare: there is no path
    // where the check can be forgotten.
    expect(prismaMock.propertyReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rep-1', reporterId: 'user-7' } }),
    )
  })

  it('answers 404 for somebody else’s report, not 403', async () => {
    // "Not yours" and "does not exist" must be indistinguishable, or a report
    // id becomes a way to enumerate reports.
    prismaMock.propertyReport.findFirst.mockResolvedValue(null)
    await expect(getThreadForReporter('rep-1', 'someone-else')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('marks the moderator’s messages read, and not its own', async () => {
    prismaMock.propertyReport.findFirst.mockResolvedValue(MINE)
    await getThreadForReporter('rep-1', 'user-7')

    // Same rule, new storage: only messages this side can actually SEE are
    // marked. A message they were never shown must not count as read, or the
    // admin panel reports somebody saw an answer they never received.
    const call = prismaMock.supportMessage.updateMany.mock.calls[0][0]
    expect(call.where.caseId).toBe('case-1')
    expect(call.where.readByUserAt).toBeNull()
    expect(call.where.authorRole.in).toContain('ADMIN')
    expect(call.where.authorRole.in).not.toContain('TENANT')
    expect(call.where.visibility.in).toContain('TENANT_ONLY')
    expect(call.where.visibility.in).not.toContain('OWNER_ONLY')
  })

  it('never exposes which admin wrote a reply', async () => {
    // adminId exists for accountability, not for the reporter. Knowing WHICH
    // moderator handled you is not information a reporter needs and is one a
    // determined person could act on.
    prismaMock.propertyReport.findFirst.mockResolvedValue(MINE)
    prismaMock.supportCase.findUnique.mockResolvedValue({
      ...CASE_FOR_MINE,
      messages: [{ id: 'm1', authorRole: 'ADMIN', body: 'hi', visibility: 'TENANT_ONLY', createdAt: new Date(), authorUser: null, attachments: [] }],
    })

    const { messages } = await getThreadForReporter('rep-1', 'user-7')

    // Asserted on the OUTPUT rather than on a select, which is stronger: it
    // holds however the row was fetched.
    //
    // `authorRole: 'ADMIN'` is REQUIRED — both clients branch on it to decide
    // which side of the thread a bubble sits on. What must never appear is
    // WHICH admin: an id or a name is what a determined person could act on.
    expect(messages[0].authorRole).toBe('ADMIN')
    for (const key of ['authorAdminId', 'adminId', 'authorAdmin', 'authorUser']) {
      expect(messages[0], key).not.toHaveProperty(key)
    }
  })
})

describe('a reporter replying', () => {
  it('is refused on a report that is not theirs', async () => {
    prismaMock.propertyReport.findFirst.mockResolvedValue(null)
    await expect(addReporterMessage('rep-1', 'someone-else', 'hi')).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.supportMessage.create).not.toHaveBeenCalled()
  })

  it('notifies nobody — admins have no notification stream', async () => {
    // The admin side works from the queue, so the unread count is what surfaces
    // this. Inventing a notify target would mean inventing an admin recipient.
    prismaMock.propertyReport.findFirst.mockResolvedValue(MINE)
    await addReporterMessage('rep-1', 'user-7', 'it is the same photos as listing 12')
    expect(notifyUser).not.toHaveBeenCalled()
  })
})

describe('a moderator replying', () => {
  it('tells the reporter, and does not put the reply text in the notification', async () => {
    prismaMock.propertyReport.findUnique.mockResolvedValue({ id: 'rep-1', reporterId: 'user-7', supportCaseId: 'case-1' })
    await addAdminMessage('rep-1', 'admin-1', 'Which of the photos looked reused?')

    expect(notifyUser).toHaveBeenCalledWith('user-7', expect.objectContaining({
      type: 'REPORT_UPDATE', audience: 'TENANT', referenceId: 'rep-1',
    }))
    // The body lives in the thread. A push preview on a lock screen must not
    // carry moderation text, and the reporter should read it where it is
    // marked read.
    expect(JSON.stringify(notifyUser.mock.calls[0][1])).not.toMatch(/reused/)
  })

  it('refuses to reply to an anonymous report rather than storing it nowhere', async () => {
    // A moderator who typed an answer deserves to know it cannot be delivered.
    prismaMock.propertyReport.findUnique.mockResolvedValue({ id: 'rep-1', reporterId: null, supportCaseId: 'case-1' })
    await expect(addAdminMessage('rep-1', 'admin-1', 'hello?')).rejects.toMatchObject({
      statusCode: 400, expose: true,
    })
    expect(prismaMock.supportMessage.create).not.toHaveBeenCalled()
  })

  it('records which admin replied', async () => {
    prismaMock.propertyReport.findUnique.mockResolvedValue({ id: 'rep-1', reporterId: 'user-7', supportCaseId: 'case-1' })
    await addAdminMessage('rep-1', 'admin-1', 'thanks')
    expect(prismaMock.supportMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorRole: 'ADMIN', authorAdminId: 'admin-1' }) }),
    )
  })
})

describe('the moderator’s view', () => {
  it('says up front whether a reply is even possible', async () => {
    prismaMock.propertyReport.findUnique.mockResolvedValue({ id: 'rep-1', reporterId: null, isAnonymous: true, supportCaseId: 'case-1' })
    expect((await getThreadForAdmin('rep-1')).canReply).toBe(false)

    prismaMock.propertyReport.findUnique.mockResolvedValue({ id: 'rep-1', reporterId: 'user-7', supportCaseId: 'case-1' })
    expect((await getThreadForAdmin('rep-1')).canReply).toBe(true)
  })

  it('surfaces reports with an unread reporter message', async () => {
    // The admin side has no notifications, so without this a reporter's reply
    // lands in a thread nobody opens.
    prismaMock.supportMessage.findMany.mockResolvedValue([
      { case: { report: { id: 'rep-1' } } },
      { case: { report: { id: 'rep-9' } } },
    ])
    expect(await reportsAwaitingModerator()).toEqual(['rep-1', 'rep-9'])

    // Same rule on the new storage: unread REPORTER messages only, one row per
    // case, and scoped to cases that are actually reports — a general support
    // request is not part of the moderation queue.
    const { where, distinct } = prismaMock.supportMessage.findMany.mock.calls[0][0]
    expect(where.authorRole).toBe('TENANT')
    expect(where.readByAdminAt).toBeNull()
    expect(where.case).toEqual({ report: { isNot: null } })
    expect(distinct).toEqual(['caseId'])
  })
})

describe('the owner is not a party', () => {
  it('has no owner-side function in this module at all', async () => {
    const mod = await import('../src/features/reports/reportThread.service.js')
    const owner = Object.keys(mod).filter((k) => /owner/i.test(k))
    expect(owner, `an owner path into the report thread: ${owner.join(', ')}`).toEqual([])
  })

  it('is not given messages by the owner-facing report list', async () => {
    // getOwnerReports is what an owner CAN read. If `messages` ever appears in
    // its select, an anonymous reporter's words reach the person they reported.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../src/features/reports/reports.service.js', import.meta.url), 'utf8')
    const fn = src.split('export async function getOwnerReports')[1].split('\nexport ')[0]
    expect(fn).not.toMatch(/messages/)
  })
})
