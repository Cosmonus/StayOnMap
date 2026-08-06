/**
 * Host dashboard (features/host/host.service.js)
 *
 * What these guard against:
 *   viewerViews    — null when we have no record, NEVER 0. "she has viewed it
 *                    0 times" is a claim, and someone can request a visit
 *                    straight from a map pin without opening the listing.
 *   pair scoping   — one tenant's view count must never be attributed to a
 *                    different tenant's request for the same listing
 *   queue order    — visits and unanswered reviews merged newest-question-first
 *   rating         — the 12 category scores averaged into the one number a
 *                    review gets summarised as
 *   empty owner    — no listings must not mean a crash or a fabricated stat
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { getHostDashboard } from '../src/features/host/host.service.js'

const RATINGS = {
  ratingsSafety: 4, ratingsClean: 4, ratingsWater: 4, ratingsNoise: 4,
  ratingsInternet: 4, ratingsParking: 4, ratingsNeighborhood: 4, ratingsTransport: 4,
  ratingsMaintenance: 4, ratingsOwnerBehavior: 4, ratingsSecurity: 4, ratingsPowerBackup: 4,
}

function listing(overrides = {}) {
  return { id: 'prop-1', title: 'Spacious 2 BHK', bhk: 2, sharing: null, landmark: 'Koramangala 5th Block', city: 'Bengaluru', ...overrides }
}

function visit(overrides = {}) {
  return {
    id: 'appt-1',
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    requestedDate: new Date('2026-07-27T00:00:00Z'),
    requestedTime: '11:00',
    message: null,
    createdAt: new Date('2026-07-26T09:00:00Z'),
    tenant: { id: 'tenant-1', name: 'Priya R.', email: 'priya@example.com', avatarUrl: null },
    property: listing(),
    ...overrides,
  }
}

function emptyStats() {
  prismaMock.propertyDailyView.aggregate.mockResolvedValue({ _sum: { count: 0 } })
  prismaMock.savedListing.count.mockResolvedValue(0)
  prismaMock.appointment.count.mockResolvedValue(0)
  prismaMock.lease.findMany.mockResolvedValue([])
}

describe('getHostDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.property.findMany.mockResolvedValue([{ id: 'prop-1' }])
    prismaMock.appointment.findMany.mockResolvedValue([])
    prismaMock.communityReview.findMany.mockResolvedValue([])
    prismaMock.propertyViewer.findMany.mockResolvedValue([])
    emptyStats()
  })

  it('labels a visit request with the person, the listing, and the time asked', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([visit()])

    const { needsYouToday } = await getHostDashboard('owner-1')

    expect(needsYouToday).toHaveLength(1)
    expect(needsYouToday[0]).toMatchObject({
      kind: 'VISIT_REQUEST',
      person: 'Priya R.',
      listing: '2 BHK Koramangala 5th Block',
      requestedTime: '11:00',
    })
  })

  it('reports viewerViews as null when there is no record — never as 0', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([visit()])
    prismaMock.propertyViewer.findMany.mockResolvedValue([])

    const { needsYouToday } = await getHostDashboard('owner-1')

    expect(needsYouToday[0].viewerViews).toBeNull()
  })

  it('attributes a view count to the right (listing, person) pair only', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      visit({ id: 'appt-1', tenantId: 'tenant-1' }),
      visit({ id: 'appt-2', tenantId: 'tenant-2', tenant: { id: 'tenant-2', name: 'Arjun M.', email: 'a@x.com' } }),
    ])
    // Only tenant-1 has looked at prop-1.
    prismaMock.propertyViewer.findMany.mockResolvedValue([
      { propertyId: 'prop-1', userId: 'tenant-1', count: 4 },
    ])

    const { needsYouToday } = await getHostDashboard('owner-1')
    const byId = Object.fromEntries(needsYouToday.map((i) => [i.id, i]))

    expect(byId['appt-1'].viewerViews).toBe(4)
    expect(byId['appt-2'].viewerViews).toBeNull()
  })

  it('averages the 12 category ratings into one number for a review', async () => {
    prismaMock.communityReview.findMany.mockResolvedValue([{
      id: 'rev-1',
      propertyId: 'prop-1',
      body: 'Owner was responsive and the water supply is as described.',
      createdAt: new Date('2026-07-26T08:00:00Z'),
      property: listing(),
      ...RATINGS,
    }])

    const { needsYouToday } = await getHostDashboard('owner-1')

    expect(needsYouToday[0]).toMatchObject({ kind: 'REVIEW', rating: 4 })
    expect(needsYouToday[0].quote).toContain('water supply')
  })

  it('merges visits and reviews into one queue, newest question first', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      visit({ id: 'older', createdAt: new Date('2026-07-25T09:00:00Z') }),
    ])
    prismaMock.communityReview.findMany.mockResolvedValue([{
      id: 'newer', propertyId: 'prop-1', body: 'Good', createdAt: new Date('2026-07-26T09:00:00Z'),
      property: listing(), ...RATINGS,
    }])

    const { needsYouToday } = await getHostDashboard('owner-1')

    expect(needsYouToday.map((i) => i.id)).toEqual(['newer', 'older'])
  })

  it('asks for unanswered visits and unanswered APPROVED reviews only', async () => {
    await getHostDashboard('owner-1')

    // Both statuses that are waiting on the OWNER for a yes or no. A renter's
    // counter-offer (RESCHEDULE_REQUESTED, added 2026-08-07) needs exactly the
    // same answer a first request does; leaving it out parked it in the queue
    // this dashboard exists to empty.
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'owner-1',
          status: { in: ['PENDING', 'RESCHEDULE_REQUESTED'] },
        }),
      })
    )
    expect(prismaMock.communityReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED', ownerResponse: null }) })
    )
  })

  it('reports zeroes, not a crash, for an owner with no live listings', async () => {
    prismaMock.property.findMany.mockResolvedValue([])

    const { needsYouToday, last30Days } = await getHostDashboard('owner-1')

    expect(needsYouToday).toEqual([])
    expect(last30Days).toMatchObject({ views: 0, saves: 0, visitRequests: 0, signedLeases: 0, listingCount: 0 })
    // No listings means no window to aggregate over — don't even ask.
    expect(prismaMock.propertyDailyView.aggregate).not.toHaveBeenCalled()
  })

  it('names the listing behind a signed lease', async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { id: 'lease-1', signedAt: new Date(), property: { bhk: 2, sharing: null, landmark: 'Koramangala 5th Block', city: 'Bengaluru' } },
    ])

    const { last30Days } = await getHostDashboard('owner-1')

    expect(last30Days.signedLeases).toBe(1)
    expect(last30Days.signedLeaseListing).toBe('2 BHK Koramangala 5th Block')
  })
})
