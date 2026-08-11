// The owner-contacts endpoint respects the per-person phone gate.
//
// getPropertyContacts shipped 2026-07-27 selecting the tenant's PROFILE phone
// with no gate at all — contactVisibility: NOBODY was simply ignored. Found
// 2026-08-12 when the contacts list grew a call button, which is exactly when
// the leak would have begun to matter. Same rule and same trap as chat's
// gateParticipantPhones: the SELECT must carry contactVisibility or the gate
// reads undefined — which is not 'NOBODY' — and a withheld number ships.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { getPropertyContacts } = await import('../src/features/properties/properties.service.js')

const contactsRow = (tenant) => ({
  id: 'p1',
  ownerId: 'owner-1',
  appointments: [{
    id: 'a1', status: 'PENDING', requestedDate: new Date(), requestedTime: '10:00',
    message: null, ownerNote: null, contactNumber: '9876543210', tenantId: tenant.id,
    createdAt: new Date(), tenant,
  }],
  conversations: [],
  savedBy: [],
  _count: { appointments: 1, conversations: 0, savedBy: 0 },
})

beforeEach(() => vi.clearAllMocks())

describe('getPropertyContacts phone gate', () => {
  it('withholds the profile phone when the person chose NOBODY — and never returns the setting', async () => {
    prismaMock.property.findFirst.mockResolvedValue(contactsRow({
      id: 'u1', name: 'Asha', email: 'a@x.in', avatarUrl: null,
      phone: '9999999999', contactVisibility: 'NOBODY',
    }))
    const result = await getPropertyContacts('p1', 'owner-1')
    const tenant = result.appointments[0].tenant
    expect(tenant.phone).toBeNull()
    expect(tenant).not.toHaveProperty('contactVisibility')
    // The visit-specific number stays: the tenant gave it TO this owner for
    // THIS visit — an explicit share in context, not a profile leak.
    expect(result.appointments[0].contactNumber).toBe('9876543210')
  })

  it('passes the phone through for everyone else', async () => {
    prismaMock.property.findFirst.mockResolvedValue(contactsRow({
      id: 'u1', name: 'Asha', email: 'a@x.in', avatarUrl: null,
      phone: '9999999999', contactVisibility: 'EVERYONE',
    }))
    const result = await getPropertyContacts('p1', 'owner-1')
    expect(result.appointments[0].tenant.phone).toBe('9999999999')
  })

  it('gates chat-only contacts by the same rule', async () => {
    prismaMock.property.findFirst.mockResolvedValue({
      id: 'p1', ownerId: 'owner-1', appointments: [],
      conversations: [{
        id: 'c1', tenantId: 'u2', lastMessageAt: new Date(),
        tenant: { id: 'u2', name: 'Ravi', email: 'r@x.in', avatarUrl: null, phone: '8888888888', contactVisibility: 'NOBODY' },
        messages: [],
      }],
      savedBy: [], _count: { appointments: 0, conversations: 1, savedBy: 0 },
    })
    const result = await getPropertyContacts('p1', 'owner-1')
    expect(result.conversations[0].tenant.phone).toBeNull()
    expect(result.conversations[0].tenant).not.toHaveProperty('contactVisibility')
  })

  it('still ASKS the database for contactVisibility in BOTH selects — dropping it is the dangerous edit', async () => {
    prismaMock.property.findFirst.mockResolvedValue(contactsRow({
      id: 'u1', name: 'Asha', email: 'a@x.in', avatarUrl: null, phone: null, contactVisibility: null,
    }))
    await getPropertyContacts('p1', 'owner-1')
    const select = prismaMock.property.findFirst.mock.calls[0][0].select
    for (const tenantSelect of [select.appointments.select.tenant.select, select.conversations.select.tenant.select]) {
      expect(tenantSelect.phone).toBe(true)
      expect(tenantSelect.contactVisibility).toBe(true)
    }
  })
})
