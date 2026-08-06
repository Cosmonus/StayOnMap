/**
 * `rent` is the primary price in every pricing mode — a monthly rent, a
 * refundable lease lump sum, an asking price, or a nightly rate — so nothing
 * may suffix or describe it blindly.
 *
 * The display half (priceUnit) has always known that. The STRUCTURED-DATA half
 * did not: PropertyPage published `priceType: 'monthly'` for every listing, so
 * the page said "₹18,00,000 lease" while telling Google ₹18,00,000 per month.
 * Nobody sees that on the page, which is exactly why it needs a test.
 *
 * Both functions live in format.js so the two cannot drift.
 */
import { describe, it, expect } from 'vitest'
import { priceUnit, offerPriceSpec } from './format'

const listing = (over) => ({ type: 'APARTMENT', pricingModel: 'RENT', rent: 28000, ...over })

describe('priceUnit', () => {
  it('reads the pricing mode, not the type alone', () => {
    expect(priceUnit(listing())).toBe('/mo')
    expect(priceUnit(listing({ pricingModel: 'LEASE' }))).toBe(' lease')
    expect(priceUnit(listing({ pricingModel: 'SALE' }))).toBe('')
    expect(priceUnit(listing({ type: 'SHORT_STAY' }))).toBe('/night')
  })

  it('a SHORT_STAY is per night whatever the pricing model says', () => {
    expect(priceUnit(listing({ type: 'SHORT_STAY', pricingModel: 'RENT' }))).toBe('/night')
  })
})

describe('offerPriceSpec', () => {
  it('a monthly rent is priced per month', () => {
    expect(offerPriceSpec(listing())).toEqual({
      '@type': 'UnitPriceSpecification', price: 28000, priceCurrency: 'INR', unitCode: 'MON',
    })
  })

  it('a nightly rate is priced per DAY, not per month', () => {
    expect(offerPriceSpec(listing({ type: 'SHORT_STAY', rent: 3200 }))).toMatchObject({ unitCode: 'DAY' })
  })

  it('a lease lump sum has no period at all', () => {
    const spec = offerPriceSpec(listing({ pricingModel: 'LEASE', rent: 1800000 }))
    expect(spec['@type']).toBe('PriceSpecification')
    expect(spec.unitCode).toBeUndefined()
  })

  it('an asking price has no period at all', () => {
    const spec = offerPriceSpec(listing({ pricingModel: 'SALE', rent: 9500000 }))
    expect(spec['@type']).toBe('PriceSpecification')
    expect(spec.unitCode).toBeUndefined()
  })

  // The bug this file exists for: a lease and a sale must never publish "per
  // month". Asserted as a rule over every mode rather than as four separate
  // cases, so a new PricingModel cannot quietly default back into it.
  it('never claims a period the page does not show', () => {
    for (const pricingModel of ['RENT', 'LEASE', 'SALE']) {
      for (const type of ['APARTMENT', 'HOUSE', 'LAND', 'PG', 'COMMERCIAL', 'SHORT_STAY']) {
        const p = listing({ type, pricingModel })
        const spec = offerPriceSpec(p)
        const hasPeriod = spec.unitCode === 'MON'
        const showsPerMonth = priceUnit(p) === '/mo'
        expect(hasPeriod, `${type} / ${pricingModel}`).toBe(showsPerMonth)
      }
    }
  })

  it('carries the price and currency, so the spec stands alone', () => {
    expect(offerPriceSpec(listing({ rent: '45000' }))).toMatchObject({ price: 45000, priceCurrency: 'INR' })
  })
})
