// Natural-language extraction, with AI OFF — which is production.
//
// The three sentences from the spec are the regression bar. Beyond them the
// important assertions are refusals: an amount with no cue is never assigned
// to rent, a place name never becomes a coordinate, and a field the category
// does not ask for is dropped.
import { describe, it, expect } from 'vitest'
import { extractByRules } from '../src/features/whatsapp/extract/rules.js'
import { extractFields } from '../src/features/whatsapp/extract/index.js'

describe('rules — the spec sentences', () => {
  it('"2bhk in Velachery for 28k"', () => {
    const r = extractByRules('2bhk in Velachery for 28k')
    expect(r.propertyType).toBe('apartment')
    expect(r.fields.bhk).toBe(2)
    expect(r.fields.rent).toBe(28000)
    expect(r.fields.locationText).toBe('Velachery')
  })

  it('"3 bedroom house in OMR, fully furnished, 35,000 rent"', () => {
    const r = extractByRules('3 bedroom house in OMR, fully furnished, 35,000 rent')
    expect(r.propertyType).toBe('house')
    expect(r.fields.bhk).toBe(3)
    expect(r.fields.furnished).toBe('FULLY')
    expect(r.fields.rent).toBe(35000)
    expect(r.fields.locationText).toBe('OMR')
  })

  it('"Plot 1200 sqft in Tambaram, asking 45 lakhs"', () => {
    const r = extractByRules('Plot 1200 sqft in Tambaram, asking 45 lakhs')
    expect(r.propertyType).toBe('land')
    expect(r.fields.extent).toBe(1200)
    expect(r.fields.extentUnit).toBe('sq.ft')
    expect(r.fields.rent).toBe(4500000)
    expect(r.fields.locationText).toBe('Tambaram')
  })

  it('the full example: type, bedrooms, place, furnishing, rent, deposit, availability', () => {
    const r = extractByRules('2bhk apartment in Velachery, fully furnished, 28k rent, 1 lakh deposit, available September')
    expect(r.propertyType).toBe('apartment')
    expect(r.fields).toMatchObject({ bhk: 2, furnished: 'FULLY', rent: 28000, deposit: 100000, locationText: 'Velachery' })
    expect(r.fields.availableFrom).toMatch(/-09-01T00:00:00\.000Z$/)
  })
})

describe('rules — refusals', () => {
  it('an amount with no cue is reported as uncertain, never assigned', () => {
    const r = extractByRules('2bhk flat, 28000')
    expect(r.fields.rent).toBeUndefined()
    expect(r.uncertain).toEqual(['₹28,000'])
  })

  it('a pincode, a year and "2bhk" are not money', () => {
    const r = extractByRules('2bhk near 600042, built 2019, rent 20k')
    expect(r.fields.rent).toBe(20000)
    expect(r.uncertain).toEqual([])
  })

  it('a place name is text, never a coordinate', () => {
    const r = extractByRules('near Phoenix Mall Velachery')
    expect(r.fields.locationText).toBe('Phoenix Mall Velachery')
    expect(r.fields.lat).toBeUndefined()
  })

  it('reads PG facts: sharing, gender, food', () => {
    const r = extractByRules('single sharing pg for girls with food, 9500 rent', { category: 'pg' })
    expect(r.fields).toMatchObject({ sharing: 1, genderPreference: 'FEMALE', foodIncluded: true, rent: 9500 })
  })

  it('reads a short stay: per-night price and guests', () => {
    const r = extractByRules('homestay near the beach, sleeps 4, 3500 per night', { category: 'stay' })
    expect(r.propertyType).toBe('stay')
    expect(r.fields).toMatchObject({ maxGuests: 4, nightlyRate: 3500 })
  })
})

describe('merge — the questionnaire is the last gate', () => {
  it('validates each value against its question and drops fields the category never asks', async () => {
    const out = await extractFields('2 bathrooms, 4th floor, fully furnished', { category: 'land' })
    expect(out.fields.bathrooms).toBeUndefined()
    expect(out.fields.furnished).toBeUndefined()
    expect(out.applied).toEqual([])
  })

  it('applies what the category does ask, and reports the answered question', async () => {
    const q = { id: 'rent', field: 'rent' }
    const out = await extractFields('rent is 28k and deposit 1 lakh', { category: 'apartment', currentQuestion: q })
    expect(out.fields).toEqual({ rent: 28000, deposit: 100000 })
    expect(out.currentQuestionAnswered).toBe(true)
    expect(out.hadSignal).toBe(true)
  })

  it('a value outside the question bounds is rejected rather than stored', async () => {
    const out = await extractFields('99 bath', { category: 'apartment' })
    expect(out.fields.bathrooms).toBeUndefined()
    expect(out.rejected).toContain('bathrooms')
  })

  it('reports nothing for small talk', async () => {
    const out = await extractFields('hello there')
    expect(out.hadSignal).toBe(false)
    expect(out.fields).toEqual({})
  })
})
