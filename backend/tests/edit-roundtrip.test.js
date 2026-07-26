import { describe, it, expect } from 'vitest'
import {
  categoryFromType, draftFromProperty, deriveType, DESCRIBE,
  missingRequirements, buildUpdatePayload,
} from '../../frontend/src/features/listings/config/onboarding.js'
import { updatePropertySchema } from '../src/features/properties/properties.validation.js'

// A saved plot, as Prisma returns it (Decimals as strings, relations nested)
const plot = {
  id: 'p1', type: 'LAND', title: 'A 2400 sq.ft residential plot',
  description: 'A description comfortably over the ten character minimum.',
  address: '12, 4th Cross, Indiranagar', city: 'Bengaluru', state: 'Karnataka',
  pincode: '560038', landmark: 'Near the metro', lat: '12.9716', lng: '77.5946',
  landType: 'Residential', saleOrLease: 'SALE', extent: '2400', extentUnit: 'sq.ft',
  dimensions: '40 x 60 ft', roadWidth: '30', approvalStatus: 'DTCP', facingDirection: 'EAST',
  surveyNumber: 'Sy. No. 12/3B', landRecordType: 'A-khata', landRecordNumber: 'BBMP/2019/4412',
  conversionStatus: 'Converted', ecAvailable: true, ecYears: 30, guidelineValue: '3200',
  pricingModel: 'SALE', rent: '45000000', deposit: '200000',
  availableFrom: new Date('2026-09-01T00:00:00Z'), priceNegotiable: true, loanEligible: true,
  brokerage: '0', images: [{ url: 'https://example.com/a.jpg' }], amenities: [{ amenity: { name: 'Borewell' } }],
  rules: null,
}

describe('edit round-trip through the shared form', () => {
  it('a saved listing survives property → draft → update payload', () => {
    const key = categoryFromType(plot.type)
    expect(key).toBe('land')

    const draft = draftFromProperty(plot, key)
    expect(missingRequirements(key, draft)).toEqual([])
    expect(draft.pricingModel).toBe('SALE')
    expect(draft.fields.surveyNumber).toBe('Sy. No. 12/3B')
    expect(draft.fields.landRecordType).toBe('A-khata')
    expect(draft.terms.availableFrom).toBe('2026-09-01')
    expect(draft.terms.loanEligible).toBe(true)
    expect(draft.amenityNames).toEqual(['Borewell'])
    expect(draft.zeroBrokerage).toBe(true)

    const type = deriveType(key, draft.fields[DESCRIBE[key].k])
    const payload = buildUpdatePayload(key, type, draft, ['am-1'])

    // Never editable: a listing does not become another kind, and flipping the
    // mode would silently re-read `rent`.
    expect(payload.type).toBeUndefined()
    expect(payload.pricingModel).toBeUndefined()

    // A crore-scale asking price must remain editable.
    expect(payload.rent).toBe(45000000)
    expect(payload.surveyNumber).toBe('Sy. No. 12/3B')
    expect(payload.ecYears).toBe(30)

    const r = updatePropertySchema.safeParse(payload)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true)
  })

  it('maps every property type back to a category the form can render', () => {
    for (const [type, expected] of [
      ['APARTMENT', 'apartment'], ['HOUSE', 'house'], ['VILLA', 'house'],
      ['INDEPENDENT_HOUSE', 'house'], ['LAND', 'land'], ['PG', 'pg'],
      ['COMMERCIAL', 'shop'], ['SHORT_STAY', 'stay'],
    ]) {
      expect(categoryFromType(type)).toBe(expected)
    }
  })
})
