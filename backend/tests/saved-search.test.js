// Saved searches: a filter set worth telling somebody about later.
//
// Almost every assertion here is about NOT notifying, because that is where
// this feature can lie. The three rules from the design (todo.md, 2026-08-10):
// alert only on NEW matches and never on edits; respect the same bounds
// semantics the grid uses; and a listing reaching ACTIVE via a tenant VACATING
// is not new supply. The first and third are enforced upstream by
// firstPublishStamp() — the matcher fires only where the stamp is written — so
// what this file pins is the matcher's own honesty plus that gating shape.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const notifyUser = vi.fn().mockResolvedValue({})
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: (...a) => notifyUser(...a),
}))

const { matchNewSupply, whereForSearch, createSavedSearch, deleteSavedSearch } =
  await import('../src/features/savedSearches/savedSearch.service.js')
const { createSavedSearchSchema } =
  await import('../src/features/savedSearches/savedSearch.validation.js')
const { firstPublishStamp } =
  await import('../src/features/properties/publishedAt.js')

const PROPERTY = { ownerId: 'owner-1', title: '2 BHK in Indiranagar', city: 'Bengaluru' }
const search = (over = {}) => ({
  id: 's1', userId: 'renter-1', name: 'My search', query: { pricingModel: 'RENT' }, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.savedSearch.findMany.mockResolvedValue([])
  prismaMock.property.findUnique.mockResolvedValue(PROPERTY)
})

describe('the gate: only genuinely new supply can fire the matcher', () => {
  // The matcher's call sites test `stamp.publishedAt` — so these three pin
  // that the stamp itself refuses the cases the feature must never alert on.
  it('a reinstated listing stamps nothing, so nobody is alerted', () => {
    expect(firstPublishStamp({ status: 'INACTIVE', publishedAt: new Date() }, 'ACTIVE')).toEqual({})
  })

  it('a vacancy stamps nothing — a tenant moving out is the same home again', () => {
    expect(firstPublishStamp({ status: 'OCCUPIED', publishedAt: null }, 'ACTIVE')).toEqual({})
  })

  it('first approval stamps, which is the one moment an alert is truthful', () => {
    expect(firstPublishStamp({ status: 'PENDING', publishedAt: null }, 'ACTIVE'))
      .toHaveProperty('publishedAt')
  })
})

describe('matchNewSupply', () => {
  it('does nothing at all when nobody saved a search', async () => {
    const n = await matchNewSupply('p1')
    expect(n).toBe(0)
    // Not even the property lookup — an empty table must cost one query.
    expect(prismaMock.property.findUnique).not.toHaveBeenCalled()
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('notifies the searcher whose filters the listing satisfies', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([search()])
    prismaMock.property.count.mockResolvedValue(1)
    const n = await matchNewSupply('p1')
    expect(n).toBe(1)
    expect(notifyUser).toHaveBeenCalledWith('renter-1', expect.objectContaining({
      type: 'SAVED_SEARCH_MATCH',
      audience: 'TENANT',
      referenceId: 'p1',
      referenceType: 'Property',
    }))
  })

  it('stays silent when the filters do not match', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([search()])
    prismaMock.property.count.mockResolvedValue(0)
    expect(await matchNewSupply('p1')).toBe(0)
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('never tells an owner about their own listing', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([search({ userId: 'owner-1' })])
    prismaMock.property.count.mockResolvedValue(1)
    expect(await matchNewSupply('p1')).toBe(0)
    expect(notifyUser).not.toHaveBeenCalled()
  })
})

describe('whereForSearch — the replayed query', () => {
  it('is scoped to the ONE property and to ACTIVE', () => {
    const where = whereForSearch('p1', { pricingModel: 'RENT' })
    expect(where.id).toBe('p1')
    expect(where.status).toBe('ACTIVE')
  })

  it('carries the pricing model, defaulting to RENT like the public read path', () => {
    // Without this a saved rent search matches a lease lump sum — the exact
    // bug the rent benchmark already had to fix once.
    expect(whereForSearch('p1', {}).pricingModel).toBe('RENT')
    expect(whereForSearch('p1', { pricingModel: 'LEASE' }).pricingModel).toBe('LEASE')
  })

  it('applies bounds only when all four corners exist — the grid rule', () => {
    const boxed = whereForSearch('p1', { swLat: 12, swLng: 77, neLat: 13, neLng: 78 })
    expect(boxed.lat).toEqual({ gte: 12, lte: 13 })
    const unboxed = whereForSearch('p1', { swLat: 12 })
    expect(unboxed.lat).toBeUndefined()
  })

  it('turns registry filters into real fragments', () => {
    const where = whereForSearch('p1', { type: ['PG'], rentMax: 10000 })
    // Two active filters → two AND fragments. The fragments' internals belong
    // to filters.registry.js and its own tests; what matters here is that a
    // stored filter is not silently dropped.
    expect(where.AND).toHaveLength(2)
  })
})

describe('the schema — what may be stored', () => {
  it('accepts a plain filter query and defaults the pricing model', () => {
    const parsed = createSavedSearchSchema.parse({ name: 'PGs', query: { type: 'PG' } })
    expect(parsed.query.pricingModel).toBe('RENT')
  })

  it('rejects half-given bounds rather than half-applying them', () => {
    // Silently ignoring two corners would alert someone about homes outside
    // the box they drew.
    expect(() => createSavedSearchSchema.parse({
      name: 'x', query: { swLat: 12, swLng: 77 },
    })).toThrow()
  })

  it('REJECTS proximity params instead of accepting-and-ignoring them', () => {
    // Zod's default would STRIP an unknown key — storing the search without
    // half its meaning, quietly broader than the screen it was saved from. A
    // 400 forces the client to omit the filter and disclose the omission.
    expect(() => createSavedSearchSchema.parse({
      name: 'x', query: { type: 'PG', nearMetro: 800 },
    })).toThrow()
  })

  it('requires a non-empty name', () => {
    expect(() => createSavedSearchSchema.parse({ name: '  ', query: {} })).toThrow()
  })
})

describe('create/delete ownership', () => {
  it('caps searches per user with a message that says what to do', async () => {
    prismaMock.savedSearch.count.mockResolvedValue(10)
    await expect(createSavedSearch('u1', { name: 'x', query: {} }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.savedSearch.create).not.toHaveBeenCalled()
  })

  it('deletes through the compound where, so a stranger gets 404', async () => {
    prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteSavedSearch('someone-else', 's1'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.savedSearch.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'someone-else' },
    })
  })

  it('deletes cleanly for the owner', async () => {
    prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 1 })
    await expect(deleteSavedSearch('renter-1', 's1')).resolves.toBeUndefined()
  })
})
