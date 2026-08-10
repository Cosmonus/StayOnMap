/**
 * A thread opens on its NEWEST messages.
 *
 * `getMessages` ordered `createdAt asc` with `skip: 0, take: 50`, and neither
 * the controller nor either client ever passed pagination. So a conversation
 * past fifty messages opened on the oldest fifty and its recent half could not
 * be fetched over REST at all — you could watch a message arrive live on the
 * socket and lose it on the next reload, and the reconnect refetch that exists
 * as a safety net served the same truncated page.
 *
 * The window fix alone would only move the hole to the other end of the thread,
 * so the `before` cursor is part of the same fix rather than a follow-up.
 *
 * These assert against the QUERY rather than a real database, because the bug
 * was entirely in the query's shape: the wrong direction, and a page size with
 * no way past it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { getMessages, MESSAGE_PAGE_SIZE } = await vi.importActual('../src/features/chat/chat.service.js')
const { messagesQuerySchema } = await import('../src/features/chat/chat.validation.js')

const CONVO = { id: 'conv-1', tenantId: 'tenant-1', ownerId: 'owner-1', propertyId: 'prop-1' }

/** 51 messages, oldest first — one more than a page, which is the whole point. */
const THREAD = Array.from({ length: 51 }, (_, i) => ({
  id: `m${String(i).padStart(3, '0')}`,
  conversationId: 'conv-1',
  senderId: i % 2 ? 'owner-1' : 'tenant-1',
  content: `message ${i}`,
  createdAt: new Date(Date.UTC(2026, 7, 10, 0, i)),
}))

/** What Postgres would return for the query the service actually built. */
function respondLikePostgres() {
  prismaMock.message.findMany.mockImplementation(({ take, cursor, skip, orderBy }) => {
    const desc = Array.isArray(orderBy) ? orderBy[0].createdAt === 'desc' : orderBy?.createdAt === 'desc'
    let rows = desc ? [...THREAD].reverse() : [...THREAD]
    if (cursor) rows = rows.slice(rows.findIndex((m) => m.id === cursor.id) + (skip ?? 0))
    return Promise.resolve(rows.slice(0, take))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.conversation.findUnique.mockResolvedValue(CONVO)
  prismaMock.message.updateMany.mockResolvedValue({ count: 0 })
  respondLikePostgres()
})

describe('the default page', () => {
  it('is the newest messages, not the oldest', async () => {
    const rows = await getMessages('conv-1', 'tenant-1')

    expect(rows).toHaveLength(MESSAGE_PAGE_SIZE)
    // m050 is the latest message in the fixture. Before this fix the page ended
    // at m049 and m050 was unreachable.
    expect(rows.at(-1).id).toBe('m050')
    expect(rows[0].id).toBe('m001')
    expect(rows.map((m) => m.id)).not.toContain('m000')
  })

  it('still reads oldest-first, so the client renders it top-to-bottom', async () => {
    const rows = await getMessages('conv-1', 'tenant-1')
    const times = rows.map((m) => +m.createdAt)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('orders by id as well as createdAt', async () => {
    // Two messages can share a createdAt to the millisecond. Without a
    // tie-break the cursor either repeats one or drops one.
    await getMessages('conv-1', 'tenant-1')
    const { orderBy } = prismaMock.message.findMany.mock.calls[0][0]
    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })

  it('returns a bare array — released clients read the response as a list', async () => {
    expect(Array.isArray(await getMessages('conv-1', 'tenant-1'))).toBe(true)
  })
})

describe('paging backwards', () => {
  it('returns the page before the cursor, and never repeats it', async () => {
    const first = await getMessages('conv-1', 'tenant-1')
    const older = await getMessages('conv-1', 'tenant-1', { before: first[0].id })

    expect(older.map((m) => m.id)).toEqual(['m000'])
    expect(older.map((m) => m.id)).not.toContain(first[0].id)
  })

  it('skips the cursor row itself', async () => {
    await getMessages('conv-1', 'tenant-1', { before: 'm010' })
    const { cursor, skip } = prismaMock.message.findMany.mock.calls[0][0]
    expect(cursor).toEqual({ id: 'm010' })
    expect(skip).toBe(1)
  })

  it('still marks the thread read — reaching for older messages is not a reason to leave the newest unread', async () => {
    await getMessages('conv-1', 'tenant-1', { before: 'm010' })
    expect(prismaMock.message.updateMany).toHaveBeenCalled()
  })
})

describe('the query schema', () => {
  it('accepts an absent cursor — every released client sends nothing', () => {
    expect(messagesQuerySchema.safeParse({}).success).toBe(true)
  })

  it('caps limit, so a page size cannot be set from the address bar', () => {
    expect(messagesQuerySchema.safeParse({ limit: 500 }).success).toBe(false)
    expect(messagesQuerySchema.safeParse({ limit: '100' }).data.limit).toBe(100)
  })
})
