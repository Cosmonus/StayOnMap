/**
 * Lease pricing (PricingModel) — 2026-07-17
 *
 * The Kerala/Karnataka lease deal: the tenant hands over a lump sum, pays no
 * monthly rent, and the owner returns the principal when they leave.
 *
 * The load-bearing property these tests guard: `rent` holds the primary price
 * in BOTH modes — a monthly rent under RENT, a lakh-scale lump sum under
 * LEASE. Everything downstream (cards, pins, the rent benchmark, the budget
 * filter) reads that one column, so anything that lets the two mix silently
 * turns an ₹8,00,000 lease into ₹8,00,000/month.
 */
import { describe, it, expect } from 'vitest'
import { createPropertySchema, updatePropertySchema, pinsQuerySchema, listQuerySchema } from '../src/features/properties/properties.validation.js'
import { adminPinsQuerySchema, adminPropertiesQuerySchema } from '../src/features/admin/admin.validation.js'
import { FILTERS, ADMIN_FILTERS, buildFilterWhere } from '../src/features/properties/filters.registry.js'

// Minimal valid APARTMENT create payload; each test overrides what it cares about.
const base = {
  title: 'Sunlit 2BHK near the beach',
  description: 'A bright two-bedroom flat close to everything.',
  type: 'APARTMENT',
  bhk: 2,
  address: '12 Beach Road, Besant Nagar',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600090',
  lat: 13.0,
  lng: 80.26,
  rent: 28000,
  deposit: 56000,
  images: ['https://example.com/a.jpg'],
}

const parse = (payload) => createPropertySchema.safeParse(payload)

describe('createPropertySchema — pricingModel', () => {
  it('defaults to RENT so every existing listing path is unchanged', () => {
    const r = parse(base)
    expect(r.success).toBe(true)
    expect(r.data.pricingModel).toBe('RENT')
  })

  it('accepts a LEASE flat with the lump sum in rent and no deposit', () => {
    const r = parse({ ...base, pricingModel: 'LEASE', rent: 800000, deposit: 0 })
    expect(r.success).toBe(true)
    expect(r.data.rent).toBe(800000)
  })

  it('accepts LEASE for every lease-eligible type', () => {
    for (const type of ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE']) {
      const r = parse({ ...base, type, pricingModel: 'LEASE', rent: 800000, deposit: 0 })
      expect(r.success, `${type} should be lease-eligible`).toBe(true)
    }
    const shop = parse({
      ...base, type: 'COMMERCIAL', bhk: undefined, commercialType: 'Retail shop',
      pricingModel: 'LEASE', rent: 2500000, deposit: 0,
    })
    expect(shop.success, 'COMMERCIAL should be lease-eligible').toBe(true)
  })

  // PG prices per bed, SHORT_STAY per night, LAND has its own saleOrLease —
  // a lease deal is meaningless for all three.
  it('rejects LEASE for PG, SHORT_STAY and LAND', () => {
    const pg = parse({ ...base, type: 'PG', bhk: undefined, sharing: 2, pricingModel: 'LEASE', rent: 800000, deposit: 0 })
    expect(pg.success).toBe(false)

    const stay = parse({
      ...base, type: 'SHORT_STAY', placeType: 'Entire place', nightlyRate: 5000,
      pricingModel: 'LEASE', rent: 800000, deposit: 0,
    })
    expect(stay.success).toBe(false)

    const land = parse({
      ...base, type: 'LAND', bhk: undefined, landType: 'Residential', extent: 2400,
      pricingModel: 'LEASE', rent: 800000, deposit: 0,
    })
    expect(land.success).toBe(false)
  })

  // On a lease the lump sum IS the money at stake. A second refundable deposit
  // on top is a different deal, and reads as a hidden extra charge.
  it('rejects a LEASE listing carrying a separate deposit', () => {
    const r = parse({ ...base, pricingModel: 'LEASE', rent: 800000, deposit: 50000 })
    expect(r.success).toBe(false)
    expect(r.error.issues.some((i) => i.path.includes('deposit'))).toBe(true)
  })

  it('still allows a deposit under RENT', () => {
    expect(parse({ ...base, deposit: 56000 }).success).toBe(true)
  })
})

describe('updatePropertySchema — pricingModel is not updatable', () => {
  // Flipping mode silently re-reads `rent`: an ₹8L lease sum becomes ₹8L/month.
  // A partial payload also has no `type` to re-check eligibility against.
  it('strips pricingModel instead of applying it', () => {
    const r = updatePropertySchema.safeParse({ rent: 30000, pricingModel: 'LEASE' })
    expect(r.success).toBe(true)
    expect(r.data.pricingModel).toBeUndefined()
  })
})

describe('filters.registry — pricingModel', () => {
  it('maps to an exact match', () => {
    expect(buildFilterWhere({ pricingModel: 'LEASE' }, FILTERS)).toEqual([{ pricingModel: 'LEASE' }])
  })

  // SALE became a real mode on 2026-07-26 (flats/houses/shops/land can be
  // sold), so it belongs INSIDE the enum now. This assertion used to name SALE
  // as the example of an invalid value — kept pointed at the same boundary,
  // just at a value that is genuinely not a pricing model.
  it('accepts SALE and rejects anything outside the enum', () => {
    expect(FILTERS.pricingModel.schema.safeParse('SALE').success).toBe(true)
    expect(buildFilterWhere({ pricingModel: 'SALE' }, FILTERS)).toEqual([{ pricingModel: 'SALE' }])
    expect(FILTERS.pricingModel.schema.safeParse('AUCTION').success).toBe(false)
  })

  // No registry-level default: the public map sends pricingModel=RENT itself,
  // while admin must see BOTH modes. A default here would hide every lease
  // listing from moderation.
  it('applies no constraint when absent, for either registry', () => {
    expect(buildFilterWhere({}, FILTERS)).toEqual([])
    expect(buildFilterWhere({}, ADMIN_FILTERS)).toEqual([])
  })

  it('is available to admin too', () => {
    expect(ADMIN_FILTERS.pricingModel).toBeDefined()
  })
})

// The bug this guards: toQueryParams omits any filter equal to its default, so
// the web client never sends pricingModel=RENT. Without a server-side default,
// the plain map query would return lease listings mixed in with rent ones and
// render an ₹8,00,000 lump sum as ₹8,00,000/month.
describe('public query schemas default to RENT; admin sees both', () => {
  const bounds = { swLat: '12.8', swLng: '77.4', neLat: '13.1', neLng: '77.8' }

  it('/pins defaults to RENT when the client omits it', () => {
    const q = pinsQuerySchema.parse({ ...bounds })
    expect(q.pricingModel).toBe('RENT')
    expect(buildFilterWhere(q, FILTERS)).toContainEqual({ pricingModel: 'RENT' })
  })

  it('/properties list defaults to RENT too', () => {
    expect(listQuerySchema.parse({}).pricingModel).toBe('RENT')
  })

  it('still honours an explicit LEASE from the toggle', () => {
    expect(pinsQuerySchema.parse({ ...bounds, pricingModel: 'LEASE' }).pricingModel).toBe('LEASE')
  })

  it('admin applies NO pricing constraint by default — lease must stay moderatable', () => {
    const pins = adminPinsQuerySchema.parse({})
    expect(pins.pricingModel).toBeUndefined()
    expect(buildFilterWhere(pins, ADMIN_FILTERS)).toEqual([])
    expect(adminPropertiesQuerySchema.parse({}).pricingModel).toBeUndefined()
  })
})
