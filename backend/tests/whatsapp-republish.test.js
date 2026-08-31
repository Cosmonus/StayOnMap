// publishFromConversation's UPDATE branch: a conversation that already made a
// Property EDITS it — same row, through the same updateProperty() the web
// wizard uses. PENDING stays PENDING (already queued); DRAFT and REJECTED go
// back through publishProperty; ACTIVE is refused; a deleted listing falls
// through to a fresh create rather than erroring the owner.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const createProperty = vi.fn()
const updateProperty = vi.fn()
const publishProperty = vi.fn()
vi.mock('../src/features/properties/properties.service.js', () => ({
  createProperty: (...a) => createProperty(...a),
  updateProperty: (...a) => updateProperty(...a),
  publishProperty: (...a) => publishProperty(...a),
}))

const { publishFromConversation, propertyEditability, EDITABLE_STATUSES } = await import('../src/features/whatsapp/publish.service.js')

const USER = { id: 'u1', role: 'OWNER', isBusiness: false, isBlocked: false, city: 'Bengaluru', phone: '9876543210' }
const DRAFT = {
  fields: { bhk: 2, rent: 28000, deposit: 100000, furnished: 'FULLY', amenities: [], rules: [], details: null, bathrooms: null, parking: null, floor: null, totalFloors: null, availableFrom: null },
  location: { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', locality: 'Koramangala', address: '12, 5th Block, Koramangala', state: 'Karnataka', pincode: '560095', confirmed: true },
  photos: [{ url: `${process.env.SUPABASE_URL ?? 'https://x.supabase.co'}/storage/v1/object/public/StayOnMap/properties/u/a_full.webp` }],
  photosDone: true, flags: {},
}
const conv = (propertyId = null) => ({ id: 'c1', userId: 'u1', propertyType: 'apartment', propertyId, draft: DRAFT })

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue({ ...USER })
  prismaMock.user.update.mockImplementation(async ({ data }) => ({ ...USER, ...data }))
  prismaMock.amenity.findMany.mockResolvedValue([])
  createProperty.mockResolvedValue({ id: 'p-new', status: 'DRAFT' })
  updateProperty.mockResolvedValue({ id: 'p1', status: 'PENDING' })
  publishProperty.mockImplementation(async (id) => ({ id, status: 'PENDING' }))
})

describe('propertyEditability', () => {
  it('names the editable statuses and refuses ACTIVE', () => {
    expect(EDITABLE_STATUSES).toEqual(['DRAFT', 'PENDING', 'REJECTED'])
  })
  it('a property owned by someone else reads as gone, not as forbidden', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ status: 'PENDING', ownerId: 'somebody-else' })
    expect(await propertyEditability('p1', 'u1')).toEqual({ exists: false, editable: false, status: null })
  })
})

describe('publishFromConversation with an existing property', () => {
  it('PENDING: updates in place and does NOT re-publish (it is already queued)', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ status: 'PENDING', ownerId: 'u1' })
    const r = await publishFromConversation(conv('p1'))
    expect(r.ok).toBe(true)
    expect(r.updated).toBe(true)
    expect(updateProperty).toHaveBeenCalledWith('p1', 'u1', expect.objectContaining({ rent: 28000 }))
    expect(publishProperty).not.toHaveBeenCalled()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('REJECTED: updates (which stamps ownerEditedAt) then resubmits through publishProperty', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ status: 'REJECTED', ownerId: 'u1' })
    const r = await publishFromConversation(conv('p1'))
    expect(r.ok).toBe(true)
    expect(updateProperty).toHaveBeenCalled()
    expect(publishProperty).toHaveBeenCalledWith('p1', 'u1')
  })

  it('ACTIVE: refused — never knocked out of ACTIVE, never duplicated', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ status: 'ACTIVE', ownerId: 'u1' })
    const r = await publishFromConversation(conv('p1'))
    expect(r.ok).toBe(false)
    expect(updateProperty).not.toHaveBeenCalled()
    expect(createProperty).not.toHaveBeenCalled()
  })

  it('deleted underneath: falls through to a fresh create', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)
    const r = await publishFromConversation(conv('p-gone'))
    expect(r.ok).toBe(true)
    expect(r.updated).toBeFalsy()
    expect(createProperty).toHaveBeenCalled()
  })

  it('no propertyId: the ordinary create path, untouched', async () => {
    const r = await publishFromConversation(conv(null))
    expect(r.ok).toBe(true)
    expect(createProperty).toHaveBeenCalled()
    expect(updateProperty).not.toHaveBeenCalled()
  })
})
