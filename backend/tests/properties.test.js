/**
 * Properties service tests
 *
 * What each suite guards against:
 *   listProperties    — DRAFT/PENDING must never appear in public results
 *   getPropertyById   — owner can see own DRAFT; stranger cannot
 *   getPropertyContacts — 404 when ownerId doesn't match; succeeds when it does
 *   createProperty    — 403 for disallowed city; 403 when owner already has 3 active listings
 *   publishProperty   — PENDING/ACTIVE cannot be re-published; DRAFT/REJECTED can
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

// Service under test — imported AFTER mocks are registered in setup.js
import {
  listProperties,
  getPropertyById,
  getPropertyContacts,
  createProperty,
  publishProperty,
} from '../src/features/properties/properties.service.js'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeProperty(overrides = {}) {
  return {
    id: 'prop-1',
    ownerId: 'owner-1',
    title: 'Test flat',
    city: 'Bengaluru',
    status: 'ACTIVE',
    lat: 12.9716,
    lng: 77.5946,
    address: '1 Main St',
    type: 'APARTMENT',
    images: [],
    amenities: [],
    rules: null,
    trustScore: null,
    riskScore: null,
    owner: { id: 'owner-1', name: 'Owner', avatarUrl: null, createdAt: new Date() },
    currentTenant: null,
    appointments: [],
    conversations: [],
    savedBy: [],
    _count: { appointments: 0, conversations: 0, savedBy: 0 },
    ...overrides,
  }
}

// Reset all mock return values before each test so tests are fully independent
beforeEach(() => {
  vi.clearAllMocks()
})

// ─── listProperties ──────────────────────────────────────────────────────────

describe('listProperties', () => {
  it('always passes status: ACTIVE in the where clause', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({ city: 'Bengaluru' }, { skip: 0, limit: 20 })

    const [findCall] = prismaMock.property.findMany.mock.calls
    expect(findCall[0].where).toMatchObject({ status: 'ACTIVE' })
  })

  it('returns only ACTIVE properties — a DRAFT row is not in the results', async () => {
    // Simulate DB correctly returning only ACTIVE rows (the where clause ensures this)
    const activeProperty = makeProperty({ status: 'ACTIVE', id: 'active-1' })
    prismaMock.property.findMany.mockResolvedValue([activeProperty])
    prismaMock.property.count.mockResolvedValue(1)

    const { properties } = await listProperties({}, { skip: 0, limit: 20 })

    // Every returned property must be ACTIVE
    for (const p of properties) {
      expect(p.status).toBe('ACTIVE')
    }
    // The query itself must have status: 'ACTIVE' locked in — not optional
    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    expect(whereClause.status).toBe('ACTIVE')
  })

  it('does NOT include status: DRAFT or PENDING as alternatives in the where clause', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({}, { skip: 0, limit: 20 })

    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    // Must be the string 'ACTIVE', not an object like { in: [...] } that could include others
    expect(whereClause.status).toBe('ACTIVE')
    expect(whereClause.status).not.toEqual({ in: expect.arrayContaining(['DRAFT']) })
    expect(whereClause.status).not.toEqual({ in: expect.arrayContaining(['PENDING']) })
  })

  it('applies city filter when provided', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({ city: 'Chennai' }, { skip: 0, limit: 20 })

    // Filters are AND-composed fragments from filters.registry.js (so two
    // filters on the same column can't clobber each other), not top-level keys
    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    expect(whereClause.AND).toContainEqual({ city: { contains: 'Chennai', mode: 'insensitive' } })
  })

  it('returns total count alongside the rows', async () => {
    prismaMock.property.findMany.mockResolvedValue([makeProperty()])
    prismaMock.property.count.mockResolvedValue(1)

    const result = await listProperties({}, { skip: 0, limit: 20 })

    expect(result).toHaveProperty('total', 1)
    expect(result).toHaveProperty('properties')
    expect(Array.isArray(result.properties)).toBe(true)
  })

  it('applies lat/lng bounds filter when all four bounds are provided', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({ swLat: 12.8, swLng: 77.4, neLat: 13.1, neLng: 77.8 }, { skip: 0, limit: 20 })

    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    expect(whereClause.lat).toMatchObject({ gte: 12.8, lte: 13.1 })
    expect(whereClause.lng).toMatchObject({ gte: 77.4, lte: 77.8 })
  })

  it('does not apply a bounds filter when bounds are absent (regular unfiltered browsing)', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({}, { skip: 0, limit: 20 })

    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    expect(whereClause.lat).toBeUndefined()
    expect(whereClause.lng).toBeUndefined()
  })

  it('does not apply a bounds filter when only some bounds are provided (partial/malformed input)', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({ swLat: 12.8, swLng: 77.4 }, { skip: 0, limit: 20 })

    const whereClause = prismaMock.property.findMany.mock.calls[0][0].where
    expect(whereClause.lat).toBeUndefined()
    expect(whereClause.lng).toBeUndefined()
  })
})

// ─── getPropertyById ─────────────────────────────────────────────────────────

describe('getPropertyById', () => {
  it('returns null when property does not exist', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)

    const result = await getPropertyById('nonexistent-id')

    expect(result).toBeNull()
  })

  it('returns an ACTIVE property to any visitor (no userId)', async () => {
    const property = makeProperty({ status: 'ACTIVE' })
    prismaMock.property.findUnique.mockResolvedValue(property)

    const result = await getPropertyById('prop-1')

    expect(result).not.toBeNull()
    expect(result.id).toBe('prop-1')
  })

  // The owner's listing page reports reach, so a view has to be counted — but
  // only somebody ELSE's view of a LIVE listing, and never at the cost of the
  // page itself.
  it('counts a visitor view, and does not count the owner looking at their own', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'ACTIVE', ownerId: 'owner-1' }))

    await getPropertyById('prop-1')
    expect(prismaMock.property.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { viewCount: { increment: 1 } },
    })

    prismaMock.property.update.mockClear()
    await getPropertyById('prop-1', 'owner-1')
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('still returns the property when the view counter fails', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'ACTIVE' }))
    prismaMock.property.update.mockRejectedValueOnce(new Error('db down'))

    const result = await getPropertyById('prop-1')

    expect(result?.id).toBe('prop-1')
  })

  it('owner can see their own DRAFT property', async () => {
    const draftProperty = makeProperty({ status: 'DRAFT', ownerId: 'owner-1' })
    prismaMock.property.findUnique.mockResolvedValue(draftProperty)

    const result = await getPropertyById('prop-1', 'owner-1')

    // Because userId matches ownerId the service returns the property unconditionally
    expect(result).not.toBeNull()
    expect(result.status).toBe('DRAFT')
  })

  it('non-owner receives null for a DRAFT property', async () => {
    const draftProperty = makeProperty({ status: 'DRAFT', ownerId: 'owner-1' })
    prismaMock.property.findUnique.mockResolvedValue(draftProperty)

    const result = await getPropertyById('prop-1', 'some-other-user')

    // status !== 'ACTIVE' and userId !== ownerId → must return null
    expect(result).toBeNull()
  })

  it('unauthenticated visitor receives null for a DRAFT property', async () => {
    const draftProperty = makeProperty({ status: 'DRAFT', ownerId: 'owner-1' })
    prismaMock.property.findUnique.mockResolvedValue(draftProperty)

    const result = await getPropertyById('prop-1', null)

    expect(result).toBeNull()
  })

  it('non-owner receives null for a PENDING property', async () => {
    const pendingProperty = makeProperty({ status: 'PENDING', ownerId: 'owner-1' })
    prismaMock.property.findUnique.mockResolvedValue(pendingProperty)

    const result = await getPropertyById('prop-1', 'tenant-xyz')

    expect(result).toBeNull()
  })
})

// ─── getPropertyById — owner phone gated by contactVisibility ────────────────
// The public payload must only carry the owner's phone when their
// contactVisibility allows THIS viewer. The setting itself never ships.

describe('getPropertyById — owner contact visibility', () => {
  function mockOwnerPrivacy(privacy) {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty())
    prismaMock.user.findUnique.mockResolvedValue(privacy)
  }

  it('ships the phone to a guest when visibility is EVERYONE', async () => {
    mockOwnerPrivacy({ phone: '9876543210', contactVisibility: 'EVERYONE' })

    const result = await getPropertyById('prop-1', null)

    expect(result.owner.phone).toBe('9876543210')
  })

  it('withholds the phone from a guest when visibility is LOGGED_IN', async () => {
    mockOwnerPrivacy({ phone: '9876543210', contactVisibility: 'LOGGED_IN' })

    const result = await getPropertyById('prop-1', null)

    expect(result.owner.phone).toBeUndefined()
  })

  it('ships the phone to a logged-in viewer when visibility is LOGGED_IN', async () => {
    mockOwnerPrivacy({ phone: '9876543210', contactVisibility: 'LOGGED_IN' })

    const result = await getPropertyById('prop-1', 'viewer-1')

    expect(result.owner.phone).toBe('9876543210')
  })

  it('never ships the phone when visibility is NOBODY — even logged in', async () => {
    mockOwnerPrivacy({ phone: '9876543210', contactVisibility: 'NOBODY' })

    const result = await getPropertyById('prop-1', 'viewer-1')

    expect(result.owner.phone).toBeUndefined()
  })

  it('ships nothing when the owner has no phone, whatever the visibility', async () => {
    mockOwnerPrivacy({ phone: null, contactVisibility: 'EVERYONE' })

    const result = await getPropertyById('prop-1', 'viewer-1')

    expect(result.owner.phone).toBeUndefined()
  })

  it('never leaks the contactVisibility setting itself', async () => {
    mockOwnerPrivacy({ phone: '9876543210', contactVisibility: 'EVERYONE' })

    const result = await getPropertyById('prop-1', null)

    expect(result.owner.contactVisibility).toBeUndefined()
  })
})

// ─── getPropertyContacts ─────────────────────────────────────────────────────

describe('getPropertyContacts', () => {
  it('throws 404 when property exists but ownerId does not match', async () => {
    // First findUnique (debug log) returns the real owner
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'real-owner' })
    // findFirst with WHERE id + ownerId returns null (no match)
    prismaMock.property.findFirst.mockResolvedValue(null)

    await expect(getPropertyContacts('prop-1', 'wrong-owner')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 404 when property does not exist at all', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)
    prismaMock.property.findFirst.mockResolvedValue(null)

    await expect(getPropertyContacts('ghost-prop', 'any-owner')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('returns contacts when ownerId matches', async () => {
    const contactsResult = makeProperty({
      appointments: [],
      conversations: [],
      savedBy: [],
      _count: { appointments: 0, conversations: 0, savedBy: 0 },
    })
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1' })
    prismaMock.property.findFirst.mockResolvedValue(contactsResult)

    const result = await getPropertyContacts('prop-1', 'owner-1')

    expect(result).not.toBeNull()
    expect(result.id).toBe('prop-1')
  })
})

// ─── createProperty ──────────────────────────────────────────────────────────

describe('createProperty', () => {
  const validData = {
    title: 'Nice flat',
    city: 'Bengaluru',
    type: 'APARTMENT',
    rent: 20000,
    deposit: 40000,
    address: '10 MG Road',
    lat: 12.9716,
    lng: 77.5946,
    bhk: 2,
    furnished: 'SEMI',
    state: 'Karnataka',
    pincode: '560001',
  }

  it('throws 403 for a city that is not in the allowed list', async () => {
    const badCityData = { ...validData, city: 'Goa' }

    await expect(createProperty('owner-1', badCityData)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Bengaluru'),
    })

    // Prisma transaction must NOT have been called — the guard fires first
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('throws 403 for Jaipur (another disallowed city — cities expand over time)', async () => {
    await expect(createProperty('owner-1', { ...validData, city: 'Jaipur' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('allows creation for Chennai', async () => {
    const created = makeProperty({ city: 'Chennai', status: 'DRAFT' })
    prismaMock.property.count.mockResolvedValue(0)
    prismaMock.property.create.mockResolvedValue(created)

    const result = await createProperty('owner-1', { ...validData, city: 'Chennai' })

    expect(result.status).toBe('DRAFT')
  })

  // The 3-active-listing free-tier cap was removed on 2026-07-27 (see
  // properties.service.js) — this asserts an owner well past the old limit is
  // no longer stopped, so reinstating the cap without updating the tier story
  // fails here rather than silently.
  it('creates a listing for an owner who already has many active ones', async () => {
    const created = makeProperty({ status: 'DRAFT', ownerId: 'owner-1' })
    prismaMock.property.count.mockResolvedValue(12)
    prismaMock.property.create.mockResolvedValue(created)

    const result = await createProperty('owner-1', validData)

    expect(result.status).toBe('DRAFT')
    expect(prismaMock.property.create).toHaveBeenCalled()
  })

  it('creates property as DRAFT when the city is valid', async () => {
    const created = makeProperty({ status: 'DRAFT', ownerId: 'owner-1' })
    prismaMock.property.count.mockResolvedValue(2)
    prismaMock.property.create.mockResolvedValue(created)

    const result = await createProperty('owner-1', validData)

    expect(result.status).toBe('DRAFT')
    expect(prismaMock.property.create).toHaveBeenCalledOnce()
    // Verify create was called with status: 'DRAFT'
    const createArgs = prismaMock.property.create.mock.calls[0][0]
    expect(createArgs.data.status).toBe('DRAFT')
  })

  it('wraps count + create in a transaction to prevent race conditions', async () => {
    prismaMock.property.count.mockResolvedValue(0)
    prismaMock.property.create.mockResolvedValue(makeProperty({ status: 'DRAFT' }))

    await createProperty('owner-1', validData)

    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })
})

// ─── publishProperty ─────────────────────────────────────────────────────────

describe('publishProperty', () => {
  it('throws 404 when property is not found (or belongs to different owner)', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)

    await expect(publishProperty('prop-1', 'owner-1')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 400 when status is PENDING — cannot publish again', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'PENDING' }))

    await expect(publishProperty('prop-1', 'owner-1')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 when status is ACTIVE — already published', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'ACTIVE' }))

    await expect(publishProperty('prop-1', 'owner-1')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 when status is SUSPENDED', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'SUSPENDED' }))

    await expect(publishProperty('prop-1', 'owner-1')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('transitions a DRAFT property to PENDING', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'DRAFT' }))
    prismaMock.property.update.mockResolvedValue(makeProperty({ status: 'PENDING' }))

    const result = await publishProperty('prop-1', 'owner-1')

    // submittedAt is set here and nowhere else: "Submitted 4 hours ago" on the
    // owner's listing page has to mean submitted, and updatedAt moves on any
    // later edit.
    expect(prismaMock.property.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', submittedAt: expect.any(Date) }) })
    )
    expect(result.status).toBe('PENDING')
  })

  it('transitions a REJECTED property to PENDING (re-submission allowed)', async () => {
    prismaMock.property.findUnique.mockResolvedValue(makeProperty({ status: 'REJECTED' }))
    prismaMock.property.update.mockResolvedValue(makeProperty({ status: 'PENDING' }))

    const result = await publishProperty('prop-1', 'owner-1')

    expect(result.status).toBe('PENDING')
  })
})
