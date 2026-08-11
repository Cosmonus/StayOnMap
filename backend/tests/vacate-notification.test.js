// Vacating tells the person it happened TO.
//
// Found 2026-08-12 while auditing "every action tells the other side":
// vacateProperty was the ONE tenancy action with no notification — the owner
// marked somebody as moved out, their tenancy record gained an end date,
// reviews unlocked, and they learned nothing. An action written into another
// person's history is always announced to them; confirm/decline already live
// by that rule, and this pins it at the other end of the tenancy.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const notifyUser = vi.fn().mockResolvedValue({})
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: (...a) => notifyUser(...a),
}))

const { vacateProperty } = await import('../src/features/properties/properties.service.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.property.update.mockResolvedValue({ id: 'p1', status: 'ACTIVE' })
})

describe('vacateProperty notification', () => {
  it('tells the vacated tenant, addressed to the TENANT hat', async () => {
    prismaMock.property.findUnique.mockResolvedValue({
      id: 'p1', ownerId: 'owner-1', status: 'OCCUPIED',
      currentTenantId: 'renter-1', title: 'Sunny 2BHK',
    })
    await vacateProperty('p1', 'owner-1')
    expect(notifyUser).toHaveBeenCalledWith('renter-1', expect.objectContaining({
      type: 'TENANCY_UPDATE',
      audience: 'TENANT',
      referenceType: 'Tenancy',
    }))
    // The body carries the review unlock — the end date is exactly what makes
    // reviewing possible, and a notification that says only "ended" withholds
    // the one thing the reader can now DO.
    const { body } = notifyUser.mock.calls[0][1]
    expect(body).toContain('review')
  })

  it('stays silent when there is no recorded tenant to tell', async () => {
    // OCCUPIED with a null currentTenantId shouldn't exist, but a notification
    // to `undefined` would throw inside the fire-and-forget and hide a real
    // vacate behind a swallowed error.
    prismaMock.property.findUnique.mockResolvedValue({
      id: 'p1', ownerId: 'owner-1', status: 'OCCUPIED',
      currentTenantId: null, title: 'Sunny 2BHK',
    })
    await vacateProperty('p1', 'owner-1')
    expect(notifyUser).not.toHaveBeenCalled()
  })
})
