/**
 * Blocking a person actually stops them reaching you.
 *
 * This is a store-review requirement (Apple Guideline 1.2) before it is a
 * feature: an app with 1:1 chat between strangers has to let someone shut an
 * abuser out. But the reason it is pinned here is that every failure mode is
 * SILENT — a block that doesn't hold looks exactly like a block that does,
 * right up until the moment it matters to a real person.
 *
 * Three things are load-bearing, and each has its own way of quietly breaking:
 *
 *   1. The gate reads in BOTH directions. A block that only stopped the blocker
 *      from sending would protect nobody, and would still pass any test that
 *      only checked the blocker's own send.
 *   2. The gate is on the SEND, not only on opening the thread. A client that
 *      already has the conversation open — or one nobody here wrote — must not
 *      be able to deliver anyway.
 *   3. The error names neither party's action. "They blocked you" hands an
 *      abuser a signal to react to; the person who did the blocking already
 *      knows, and the person who didn't has no business being told.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { sendMessage, getOrCreateConversation, getUserConversations } =
  await vi.importActual('../src/features/chat/chat.service.js')
const { blockUser, unblockUser, blockedUserIds, reportUser } =
  await vi.importActual('../src/features/users/safety.service.js')

const ALICE = 'alice'
const BOB = 'bob'

function convo(overrides = {}) {
  return { id: 'conv-1', propertyId: 'prop-1', tenantId: ALICE, ownerId: BOB, ...overrides }
}

function blockRow(blockerId, blockedId) {
  return { id: 'blk-1', blockerId, blockedId }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.appointment.findMany.mockResolvedValue([])
  prismaMock.message.findMany.mockResolvedValue([])
  prismaMock.userBlock.findFirst.mockResolvedValue(null)
  prismaMock.userBlock.findMany.mockResolvedValue([])
})

describe('the message gate', () => {
  it('stops the BLOCKER from sending', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(convo())
    prismaMock.userBlock.findFirst.mockResolvedValue(blockRow(ALICE, BOB))

    await expect(sendMessage('conv-1', ALICE, 'hello')).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  // The half that matters. If the gate only looked at
  // `{ blockerId: sender }`, this test is the one that fails — and without it,
  // "blocking works" would be true only for the person who doesn't need it.
  it('stops the BLOCKED person from sending, which is the entire point', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(convo())
    prismaMock.userBlock.findFirst.mockResolvedValue(blockRow(ALICE, BOB))

    await expect(sendMessage('conv-1', BOB, 'let me in')).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('queries for a block in both directions, not just the sender’s own', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(convo())
    prismaMock.$transaction.mockResolvedValue([{ id: 'msg-1', body: 'hi' }])

    await sendMessage('conv-1', ALICE, 'hi')

    const { where } = prismaMock.userBlock.findFirst.mock.calls[0][0]
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { blockerId: ALICE, blockedId: BOB },
        { blockerId: BOB, blockedId: ALICE },
      ]),
    )
  })

  it('says nothing about WHO blocked whom', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(convo())
    prismaMock.userBlock.findFirst.mockResolvedValue(blockRow(BOB, ALICE))

    const err = await sendMessage('conv-1', ALICE, 'hi').catch((e) => e)
    // Same sentence whichever direction the block runs. Asserting on the
    // absence of "blocked" is the point: the moment someone "improves" this
    // message to explain itself, it starts leaking.
    expect(err.message).toBe('You can no longer message this person')
    expect(err.message.toLowerCase()).not.toContain('blocked')
  })

  it('lets an unblocked pair through untouched', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(convo())
    prismaMock.$transaction.mockResolvedValue([{ id: 'msg-1', body: 'hi' }])

    await expect(sendMessage('conv-1', ALICE, 'hi')).resolves.toMatchObject({ id: 'msg-1' })
  })
})

describe('opening a thread', () => {
  it('refuses to open — or re-open — a blocked thread', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: BOB, title: 'A flat' })
    prismaMock.userBlock.findFirst.mockResolvedValue(blockRow(ALICE, BOB))

    await expect(getOrCreateConversation(ALICE, 'prop-1')).rejects.toMatchObject({ statusCode: 403 })
    // Not merely "no new row" — the EXISTING one must not come back either, or
    // the blocker sees a conversation their own list hides.
    expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
  })
})

describe('the conversation list', () => {
  it('hides threads with a blocked person, from either side', async () => {
    prismaMock.userBlock.findMany.mockResolvedValue([blockRow(ALICE, BOB)])
    prismaMock.conversation.findMany.mockResolvedValue([
      convo({ id: 'with-bob', tenantId: ALICE, ownerId: BOB }),
      convo({ id: 'with-carol', tenantId: ALICE, ownerId: 'carol' }),
    ])

    const list = await getUserConversations(ALICE)
    expect(list.map((c) => c.id)).toEqual(['with-carol'])
  })

  it('collects the counterpart id whichever side of the block the user is on', async () => {
    prismaMock.userBlock.findMany.mockResolvedValue([
      blockRow(ALICE, BOB),      // alice blocked bob
      blockRow('dave', ALICE),   // dave blocked alice
    ])
    const ids = await blockedUserIds(ALICE)
    expect([...ids].sort()).toEqual(['bob', 'dave'])
  })
})

describe('block bookkeeping', () => {
  it('is idempotent — blocking twice is one fact, not an error', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: BOB })
    await blockUser(ALICE, BOB)
    expect(prismaMock.userBlock.upsert).toHaveBeenCalled()
  })

  it('refuses self-blocks', async () => {
    await expect(blockUser(ALICE, ALICE)).rejects.toMatchObject({ statusCode: 400 })
  })

  // deleteMany, not delete: "make sure this person isn't blocked" is satisfied
  // by them not being blocked. A P2025 → 404 there answers a question nobody
  // asked.
  it('unblocking someone who was never blocked succeeds quietly', async () => {
    prismaMock.userBlock.deleteMany.mockResolvedValue({ count: 0 })
    await expect(unblockUser(ALICE, BOB)).resolves.toEqual({ blocked: false })
  })
})

describe('reporting a person', () => {
  it('rejects a cited conversation the reporter is not part of', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: BOB })
    prismaMock.conversation.findUnique.mockResolvedValue({ tenantId: 'carol', ownerId: 'dave' })

    await expect(
      reportUser(ALICE, BOB, { category: 'HARASSMENT', description: 'x'.repeat(20), conversationId: 'conv-9' }),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.userReport.create).not.toHaveBeenCalled()
  })

  it('accepts a report with no conversation at all', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: BOB })
    prismaMock.userReport.create.mockResolvedValue({ id: 'rep-1', status: 'PENDING' })

    await reportUser(ALICE, BOB, { category: 'SPAM', description: 'x'.repeat(20) })
    expect(prismaMock.userReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: null }) }),
    )
  })

  it('refuses self-reports', async () => {
    await expect(reportUser(ALICE, ALICE, { category: 'OTHER', description: 'x'.repeat(20) }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})

// The doorstep, not just the inbox. A visit request is the one action on this
// platform that produces a PHYSICAL meeting, so leaving it outside the gate
// would mean blocking someone stopped their messages and not their arrival.
describe('the appointment gate', () => {
  it('refuses a visit request between a blocked pair', async () => {
    const { requestAppointment } = await vi.importActual('../src/features/appointments/appointments.service.js')
    prismaMock.property.findUnique.mockResolvedValue({
      id: 'prop-1', ownerId: BOB, status: 'ACTIVE', riskScore: { level: 'LOW' },
    })
    prismaMock.userBlock.findFirst.mockResolvedValue(blockRow(BOB, ALICE))

    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    await expect(
      requestAppointment(ALICE, 'prop-1', { requestedDate: future, requestedTime: '10:00', contactNumber: '9876543210' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.appointment.create).not.toHaveBeenCalled()
  })
})
