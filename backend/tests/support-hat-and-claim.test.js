/**
 * Four behaviours added 2026-08-10, every one of which fails QUIETLY.
 *
 *   1. A notification goes to the hat the case was OPENED in. Hardcoding
 *      'TENANT' does not throw, does not log, and does not fail a test that
 *      only checks a notification was sent — it just delivers an owner's answer
 *      into a stream host mode filters out. The notification exists, is
 *      correct, and is invisible from the only screen they are on.
 *   2. A case CLAIMS ITSELF for whoever writes on it. If it stops, nothing
 *      breaks; two admins simply start answering the same case.
 *   3. SUPPORT_CASE_UPDATE fires for the statuses somebody is waiting on and
 *      for nothing else. Over-firing is the failure mode here, and its symptom
 *      is people ignoring the notifications that matter.
 *   4. The badge and the list agree about which cases belong to a hat. A badge
 *      counting a set the list excludes is the chat-unread bug exactly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const notifyUser = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: (...args) => notifyUser(...args),
}))

const {
  addMessage, changeStatus, listCasesForUser, unreadCountsForUser,
} = await import('../src/features/support/supportCase.service.js')

const CASE = {
  id: 'c1', number: 42, subject: 'Verification stuck', status: 'OPEN',
  createdById: 'u1', openedAs: 'TENANT', assignedToId: null,
  relatedUserId: null, relatedPropertyId: null, firstResponseAt: null,
}

/** $transaction here is given a callback; hand it the mock client back. */
function wireTransaction() {
  prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock))
}

beforeEach(() => {
  vi.clearAllMocks()
  wireTransaction()
  prismaMock.supportCase.update.mockResolvedValue({ ...CASE })
  prismaMock.supportMessage.create.mockResolvedValue({ id: 'm1', attachments: [] })
  prismaMock.supportEvent.create.mockResolvedValue({ id: 'e1' })
  prismaMock.supportCase.count.mockResolvedValue(0)
  prismaMock.supportCase.findMany.mockResolvedValue([])
})

const staff = { role: 'ADMIN', adminId: 'a1' }

describe('a notification is addressed to the hat, never to a fixed one', () => {
  it('answers an OWNER-hat case into the OWNER stream', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, openedAs: 'OWNER' })
    await addMessage('c1', staff, 'Have a look', 'PUBLIC')

    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ audience: 'OWNER' }))
  })

  it('answers a TENANT-hat case into the TENANT stream', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    await addMessage('c1', staff, 'Have a look', 'PUBLIC')

    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ audience: 'TENANT' }))
  })

  it('reaches the opener of an OWNER_ONLY reply even with no property attached', async () => {
    // The old whitelist looked for the owner OF THE PROPERTY, so on a
    // verification case — which has no property — an OWNER_ONLY reply reached
    // nobody at all.
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, openedAs: 'OWNER', relatedPropertyId: null })
    await addMessage('c1', staff, 'We need your document', 'OWNER_ONLY')

    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ audience: 'OWNER' }))
  })

  it('still tells nobody about an internal note', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    await addMessage('c1', staff, 'Looks like a duplicate', 'INTERNAL')

    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('carries the hat on a status change too', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, openedAs: 'OWNER', status: 'IN_PROGRESS' })
    await changeStatus('c1', 'RESOLVED', staff)

    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ audience: 'OWNER' }))
  })
})

describe('a case claims itself for whoever writes on it', () => {
  it('assigns an unassigned case to the replying admin', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    await addMessage('c1', staff, 'Looking now', 'PUBLIC')

    const data = prismaMock.supportCase.update.mock.calls[0][0].data
    expect(data.assignedToId).toBe('a1')
  })

  it('claims on an internal note as well — reading and noting IS picking it up', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    await addMessage('c1', staff, 'Checked the logs', 'INTERNAL')

    expect(prismaMock.supportCase.update.mock.calls[0][0].data.assignedToId).toBe('a1')
  })

  it('never takes a case away from whoever already has it', async () => {
    // Silent reassignment on reply would mean the last person to comment owns
    // it, which is the opposite of what an assignment is for.
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, assignedToId: 'a2' })
    await addMessage('c1', staff, 'Adding a note', 'INTERNAL')

    const calls = prismaMock.supportCase.update.mock.calls
    for (const [{ data }] of calls) expect(data.assignedToId).toBeUndefined()
  })

  it('is not something a USER can do by replying', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    prismaMock.property.findUnique.mockResolvedValue(null)
    await addMessage('c1', { role: 'TENANT', userId: 'u1' }, 'Any news?', 'PUBLIC')

    for (const [{ data }] of prismaMock.supportCase.update.mock.calls) {
      expect(data.assignedToId).toBeUndefined()
    }
  })

  it('records the claim in the timeline, marked as coming from a reply', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
    await addMessage('c1', staff, 'On it', 'PUBLIC')

    const events = prismaMock.supportEvent.create.mock.calls.map((c) => c[0].data)
    const assigned = events.find((e) => e.type === 'CASE_ASSIGNED')
    expect(assigned).toBeTruthy()
    expect(assigned.meta.via).toBe('reply')
  })
})

describe('SUPPORT_CASE_UPDATE says only what somebody is waiting on', () => {
  const cases = [
    ['WAITING_FOR_USER', 'SUPPORT_CASE_UPDATE'],
    ['IN_PROGRESS', 'SUPPORT_CASE_UPDATE'],
    ['RESOLVED', 'SUPPORT_CASE_RESOLVED'],
    ['CLOSED', 'SUPPORT_CASE_RESOLVED'],
  ]

  for (const [status, type] of cases) {
    it(`${status} → ${type}`, async () => {
      // From OPEN, so no case is asked to transition to itself — the lifecycle
      // rejects that, and rightly.
      prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, status: 'OPEN' })
      await changeStatus('c1', status, staff)
      expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ type }))
    })
  }

  for (const status of ['TRIAGED', 'ESCALATED']) {
    it(`says nothing about ${status} — that is our process, not their news`, async () => {
      prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, status: 'OPEN' })
      await changeStatus('c1', status, staff)
      expect(notifyUser).not.toHaveBeenCalled()
    })
  }

  it('sends WAITING_FOR_OWNER to the property owner, not to the reporter', async () => {
    // The whole point of that status is that we are blocked on the OTHER side.
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, status: 'IN_PROGRESS', relatedPropertyId: 'p1' })
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-9' })
    await changeStatus('c1', 'WAITING_FOR_OWNER', staff)

    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser).toHaveBeenCalledWith('owner-9', expect.objectContaining({ audience: 'OWNER' }))
  })

  it('is not pushed — a bell entry, not an interruption', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../src/features/notifications/notifications.service.js', import.meta.url), 'utf8')
    const pushLine = src.split('\n').find((l) => l.includes('PUSH_TYPES'))
    expect(pushLine).not.toMatch(/SUPPORT_CASE_UPDATE/)
    expect(pushLine).toMatch(/SUPPORT_CASE_RESOLVED/)
  })
})

describe('the badge counts what the list would show', () => {
  it('asks the same question of both hats and returns both', async () => {
    prismaMock.supportCase.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3)
    const counts = await unreadCountsForUser('u1')

    expect(counts).toEqual({ asTenant: 2, asOwner: 3, count: 5 })
  })

  it('scopes each count with the same clause the list uses', async () => {
    await listCasesForUser('u1', { hat: 'OWNER' })
    const listWhere = prismaMock.supportCase.findMany.mock.calls[0][0].where

    await unreadCountsForUser('u1')
    const ownerCount = prismaMock.supportCase.count.mock.calls[1][0].where

    // The owner clause is the OR of own-hat cases and cases about their
    // listings — identical on both sides, or the badge points at a set the
    // list will not show.
    expect(ownerCount.OR).toEqual(listWhere.OR)
  })

  it('counts a case once however many replies are unread', async () => {
    // The badge answers "is there something here". Three replies on one request
    // is one thing to go and read.
    await unreadCountsForUser('u1')
    const where = prismaMock.supportCase.count.mock.calls[0][0].where
    expect(where.messages.some).toBeTruthy()
  })

  it('never counts a message the hat cannot see', async () => {
    await unreadCountsForUser('u1')
    const tenant = prismaMock.supportCase.count.mock.calls[0][0].where.messages.some
    expect(tenant.visibility.in).not.toContain('INTERNAL')
    expect(tenant.visibility.in).not.toContain('OWNER_ONLY')
  })

  it('never counts the user’s own message as something waiting for them', async () => {
    await unreadCountsForUser('u1')
    const tenant = prismaMock.supportCase.count.mock.calls[0][0].where.messages.some
    expect(tenant.authorRole.in).toEqual(['ADMIN', 'SUPPORT_AGENT'])
  })
})
