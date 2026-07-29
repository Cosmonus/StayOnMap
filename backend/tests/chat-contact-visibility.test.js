/**
 * A phone number in a chat thread is gated per PERSON, in both directions.
 *
 * The call button on either side is only as good as this: the owner can ring the
 * renter and the renter can ring the owner, and each of them is withheld by
 * their OWN contactVisibility rather than by which side of the deal they are on.
 * Both parties are authenticated here, so EVERYONE and LOGGED_IN (the default)
 * pass and only NOBODY withholds.
 *
 * Worth pinning because the failure is silent and looks like a product decision:
 * drop `phone` from one of the two selects in conversationInclude and the button
 * simply stops rendering for that side — which reads as "calling is an owner
 * feature", not as a bug. (On web it read exactly that way until 2026-07-30, for
 * the different reason that there was no call button at all.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { getUserConversations, getOrCreateConversation } =
  await vi.importActual('../src/features/chat/chat.service.js')

function person(id, overrides = {}) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    avatarUrl: null,
    phone: `98765${id.length}0000`,
    contactVisibility: 'LOGGED_IN',
    ...overrides,
  }
}

function conversation({ tenant = person('tenant'), owner = person('owner') } = {}) {
  return {
    id: 'conv-1',
    propertyId: 'prop-1',
    tenantId: tenant.id,
    ownerId: owner.id,
    tenant,
    owner,
    property: { id: 'prop-1', title: 'A flat', images: [] },
    messages: [],
    _count: { messages: 0 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // The two enrichment queries getUserConversations runs over the list.
  prismaMock.appointment.findMany.mockResolvedValue([])
  prismaMock.message.findMany.mockResolvedValue([])
})

describe('conversation list', () => {
  // The assertions below feed both people in from a mock, so they prove the GATE
  // and not that both numbers were ever asked for. This one covers that half:
  // deleting `phone` from one of the two selects is the silent one-way break,
  // and dropping `contactVisibility` is worse — the gate reads undefined, which
  // is not 'NOBODY', so a withheld number would sail straight through.
  it('asks the database for both parties’ number AND their setting', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])

    await getUserConversations('owner')

    const { include } = prismaMock.conversation.findMany.mock.calls[0][0]
    for (const party of ['tenant', 'owner']) {
      expect(include[party].select.phone).toBe(true)
      expect(include[party].select.contactVisibility).toBe(true)
    }
  })

  it('carries BOTH numbers, so either party can call the other', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([conversation()])

    // Same list, whichever hat asked for it — the partition into Messages vs
    // Inbox happens in the clients.
    const [asOwner] = await getUserConversations('owner')
    expect(asOwner.tenant.phone).toBeTruthy()
    expect(asOwner.owner.phone).toBeTruthy()
  })

  it('withholds only the number of the person who chose NOBODY', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      conversation({ tenant: person('tenant', { contactVisibility: 'NOBODY' }) }),
    ])

    const [convo] = await getUserConversations('owner')
    expect(convo.tenant.phone).toBeNull()
    expect(convo.owner.phone).toBeTruthy()
  })

  it('withholds in the other direction too — the rule is the person, not the role', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      conversation({ owner: person('owner', { contactVisibility: 'NOBODY' }) }),
    ])

    const [convo] = await getUserConversations('tenant')
    expect(convo.owner.phone).toBeNull()
    expect(convo.tenant.phone).toBeTruthy()
  })

  it('never leaks the setting itself', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([conversation()])

    const [convo] = await getUserConversations('tenant')
    expect(convo.tenant).not.toHaveProperty('contactVisibility')
    expect(convo.owner).not.toHaveProperty('contactVisibility')
  })
})

describe('a freshly opened thread', () => {
  // The first thread a renter starts is returned by this path, not the list, so
  // it has to apply the same gate — otherwise the call button works on the
  // second visit and not the first.
  it('is gated the same way', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner', title: 'A flat' })
    prismaMock.conversation.findUnique.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue(
      conversation({ owner: person('owner', { contactVisibility: 'NOBODY' }) }),
    )

    const convo = await getOrCreateConversation('tenant', 'prop-1')
    expect(convo.owner.phone).toBeNull()
    expect(convo.tenant.phone).toBeTruthy()
    expect(convo.owner).not.toHaveProperty('contactVisibility')
  })
})
