// The questionnaire engine and the six per-type schemas.
//
// The load-bearing assertion is the last block: a COMPLETE draft of every
// category, run through normalize.js, passes createPropertySchema. That is
// the contract between "what the bot asks" and "what the platform stores" —
// if a schema stops asking something the listing needs, or asks for a value
// the server rejects, it fails here and not in an owner's WhatsApp.
import { describe, it, expect } from 'vitest'
import { QUESTIONNAIRES, CATEGORY_KEYS, SECTIONS, getQuestionnaire } from '../src/features/whatsapp/questionnaire/schemas.js'
import {
  nextQuestion, missingRequired, completion, parseAnswer, parseMoney, parseDate, matchOption, matchOptions, isVisible,
} from '../src/features/whatsapp/questionnaire/engine.js'
import { buildPropertyPayload, amenityNames } from '../src/features/whatsapp/questionnaire/normalize.js'
import { createPropertySchema } from '../src/features/properties/properties.validation.js'
import { AMENITIES } from '../prisma/amenities.js'

const location = { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', locality: 'Koramangala', address: '12, 5th Block, Koramangala', state: 'Karnataka', pincode: '560095', confirmed: true }
const photos = [{ url: `${process.env.SUPABASE_URL ?? 'https://x.supabase.co'}/storage/v1/object/public/StayOnMap/properties/u/a_full.webp` }]

describe('schemas — one questionnaire per category, all different', () => {
  it('declares all six categories', () => {
    expect(CATEGORY_KEYS.sort()).toEqual(['apartment', 'house', 'land', 'pg', 'shop', 'stay'])
    for (const k of CATEGORY_KEYS) expect(getQuestionnaire(k).length).toBeGreaterThan(5)
  })

  it('every question has a unique id, a section the review offers, and options where the type needs them', () => {
    for (const [key, qs] of Object.entries(QUESTIONNAIRES)) {
      const ids = qs.map((q) => q.id)
      expect(new Set(ids).size, key).toBe(ids.length)
      for (const q of qs) {
        expect(SECTIONS[q.section], `${key}.${q.id} section`).toBeTruthy()
        if (['single_select', 'multi_select', 'boolean'].includes(q.type)) expect(q.options?.length, `${key}.${q.id} options`).toBeGreaterThan(0)
      }
    }
  })

  it('asks for the exact location and photos in every category, and nothing absurd per type', () => {
    for (const k of CATEGORY_KEYS) {
      const ids = getQuestionnaire(k).map((q) => q.id)
      expect(ids).toContain('location')
      expect(ids).toContain('photos')
    }
    expect(getQuestionnaire('land').map((q) => q.id)).not.toContain('bathrooms')
    expect(getQuestionnaire('land').map((q) => q.id)).not.toContain('furnished')
    expect(getQuestionnaire('pg').map((q) => q.id)).not.toContain('bhk')
    expect(getQuestionnaire('shop').map((q) => q.id)).not.toContain('bhk')
    expect(getQuestionnaire('stay').map((q) => q.id)).toContain('nightlyRate')
  })

  it('every amenity chip is a real amenity name — an unknown one is dropped silently at publish', () => {
    for (const [key, qs] of Object.entries(QUESTIONNAIRES)) {
      const q = qs.find((x) => x.id === 'amenities')
      for (const o of q.options) expect(AMENITIES, `${key}: ${o.value}`).toContain(o.value)
    }
  })

  it('conditional questions hide until their trigger is answered', () => {
    const foodCharges = getQuestionnaire('pg').find((q) => q.id === 'foodCharges')
    expect(isVisible(foodCharges, { fields: {} })).toBe(false)
    expect(isVisible(foodCharges, { fields: { foodIncluded: true } })).toBe(false)
    expect(isVisible(foodCharges, { fields: { foodIncluded: false } })).toBe(true)
    const curfew = getQuestionnaire('pg').find((q) => q.id === 'curfewTime')
    expect(isVisible(curfew, { fields: { rules: ['curfew'] } })).toBe(true)
    expect(isVisible(curfew, { fields: { rules: [] } })).toBe(false)
  })
})

describe('engine — what is next, what is missing, how far along', () => {
  it('starts with the location for an apartment and with sale-or-lease for land', () => {
    expect(nextQuestion('apartment', { fields: {} }).id).toBe('location')
    expect(nextQuestion('land', { fields: {} }).id).toBe('saleOrLease')
  })

  it('skips answered questions, including ones answered out of order', () => {
    const draft = { fields: { bhk: 2, rent: 28000 }, location, photos: [] }
    expect(nextQuestion('apartment', draft).id).toBe('pricingModel')
  })

  it('treats null as an explicit skip, and never moves completion for optional questions', () => {
    const draft = { fields: { bhk: 2, pricingModel: 'RENT', rent: 28000, deposit: 56000, furnished: 'FULLY', bathrooms: null }, location, photos, photosDone: true }
    expect(nextQuestion('apartment', draft).id).toBe('maintenance')
    expect(completion('apartment', draft)).toBe(100)
    expect(missingRequired('apartment', draft)).toEqual([])
  })

  it('reports what is still required, in question order', () => {
    const draft = { fields: { bhk: 2 }, location, photos: [] }
    expect(missingRequired('apartment', draft).map((q) => q.id)).toEqual(['pricingModel', 'rent', 'deposit', 'furnished', 'photos'])
  })

  it('photos count only once the owner says done', () => {
    const base = { fields: { bhk: 2, pricingModel: 'RENT', rent: 1, deposit: 0, furnished: 'SEMI' }, location, photos }
    expect(missingRequired('apartment', { ...base, photosDone: false }).map((q) => q.id)).toEqual(['photos'])
    expect(missingRequired('apartment', { ...base, photosDone: true })).toEqual([])
  })
})

describe('parsing — money, dates, options', () => {
  it('reads Indian money', () => {
    expect(parseMoney('28k')).toBe(28000)
    expect(parseMoney('₹28,000')).toBe(28000)
    expect(parseMoney('1 lakh')).toBe(100000)
    expect(parseMoney('1.5 lacs')).toBe(150000)
    expect(parseMoney('45 lakhs')).toBe(4500000)
    expect(parseMoney('2 cr')).toBe(20000000)
    expect(parseMoney('Rs 9500')).toBe(9500)
    expect(parseMoney('no idea')).toBeNull()
  })

  it('reads dates the way owners write them', () => {
    const now = new Date('2026-08-25T00:00:00Z')
    expect(parseDate('immediately', now)).toBe('2026-08-25T00:00:00.000Z')
    expect(parseDate('September', now)).toBe('2026-09-01T00:00:00.000Z')
    expect(parseDate('1 sep', now)).toBe('2026-09-01T00:00:00.000Z')
    expect(parseDate('15/09/2026', now)).toBe('2026-09-15T00:00:00.000Z')
    // A month already passed rolls to next year.
    expect(parseDate('March', now)).toBe('2027-03-01T00:00:00.000Z')
    expect(parseDate('someday', now)).toBeNull()
  })

  it('matches options by value, label, index and word — and refuses ambiguity', () => {
    const q = getQuestionnaire('apartment').find((x) => x.id === 'furnished')
    expect(matchOption(q, 'FULLY').value).toBe('FULLY')
    expect(matchOption(q, 'semi furnished').value).toBe('SEMI')
    expect(matchOption(q, '3').value).toBe('UNFURNISHED')
    expect(matchOption(q, 'fully').value).toBe('FULLY')
    expect(matchOption(q, 'furnished')).toBeNull() // three candidates
    const bhk = getQuestionnaire('apartment').find((x) => x.id === 'bhk')
    expect(matchOption(bhk, '2').value).toBe(2) // numeric means the value, not the position
  })

  it('multi-select accepts numbers, names, and none', () => {
    const q = getQuestionnaire('apartment').find((x) => x.id === 'amenities')
    expect(matchOptions(q, '1, 3')).toEqual([q.options[0].value, q.options[2].value])
    expect(matchOptions(q, 'wifi and lift')).toEqual(['WiFi', 'Lift'])
    expect(matchOptions(q, 'none')).toEqual([])
  })

  it('validates one answer per question type', () => {
    const rent = getQuestionnaire('apartment').find((x) => x.id === 'rent')
    expect(parseAnswer(rent, '28k')).toEqual({ ok: true, value: 28000 })
    expect(parseAnswer(rent, 'cheap').ok).toBe(false)
    const bath = getQuestionnaire('apartment').find((x) => x.id === 'bathrooms')
    expect(parseAnswer(bath, '2 bathrooms')).toEqual({ ok: true, value: 2 })
    expect(parseAnswer(bath, 'skip')).toEqual({ ok: true, value: null })
    expect(parseAnswer(bath, '99').ok).toBe(false)
    const parking = getQuestionnaire('apartment').find((x) => x.id === 'parking')
    expect(parseAnswer(parking, 'yes')).toEqual({ ok: true, value: true })
    expect(parseAnswer(parking, 'nahi')).toEqual({ ok: true, value: false })
    const loc = getQuestionnaire('apartment').find((x) => x.id === 'location')
    expect(parseAnswer(loc, 'Velachery').ok).toBe(false)
  })
})

describe('normalize — every category produces a payload createPropertySchema accepts', () => {
  const amenityIdByName = new Map(AMENITIES.map((n) => [n, `id-${n}`]))
  const drafts = {
    apartment: { fields: { bhk: 2, pricingModel: 'RENT', rent: 28000, deposit: 100000, maintenance: 1500, furnished: 'FULLY', bathrooms: 2, area: 1100, parking: true, floor: 4, totalFloors: 12, facingDirection: 'EAST', availableFrom: '2026-09-01T00:00:00.000Z', leaseDuration: 11, noticePeriodDays: 30, amenities: ['WiFi', 'Lift'], rules: ['petsAllowed'], details: 'Sunny, quiet street.' } },
    house:     { fields: { houseStyle: 'Villa', bhk: 3, pricingModel: 'RENT', rent: 45000, deposit: 200000, furnished: 'SEMI', area: 1800, extent: 2400, totalFloors: 2, amenities: ['Garden'] } },
    land:      { fields: { saleOrLease: 'SALE', extent: 1200, extentUnit: 'sq.ft', rent: 4500000, priceNegotiable: true, loanEligible: true, landType: 'Residential', dimensions: '30 x 40 ft', approvalStatus: 'DTCP', boundaryWall: true, facingDirection: 'EAST' } },
    pg:        { fields: { pgName: 'Sunrise PG', sharing: 2, furnished: 'FULLY', rent: 9500, deposit: 19000, foodIncluded: true, totalBeds: 24, availableBeds: 6, noticePeriodDays: 30, genderPreference: 'FEMALE', amenities: ['WiFi'], rules: ['visitorsAllowed', 'curfew'], curfewTime: '10:30 PM' } },
    shop:      { fields: { commercialType: 'Restaurant', pricingModel: 'RENT', rent: 85000, deposit: 510000, carpetArea: 850, frontage: 18, floor: 0, powerLoad: 15, parking: true, suitableFor: 'café', furnished: 'SEMI', amenities: ['Washroom'] } },
    stay:      { fields: { placeType: 'Entire place', nightlyRate: 5250, cleaningFee: 800, weekendRate: 6500, minNights: 2, maxNights: 28, instantBook: true, maxGuests: 4, bhk: 2, beds: 3, bathrooms: 2, checkIn: '2 PM', checkOut: '11 AM', amenities: ['WiFi', 'Kitchen'], rules: ['bachelorAllowed', 'familyPreferred'] } },
  }

  for (const [category, draft] of Object.entries(drafts)) {
    it(`${category}: a complete draft validates and carries the type-specific columns`, () => {
      const full = { ...draft, location, photos, photosDone: true }
      expect(missingRequired(category, full), `${category} still missing`).toEqual([])
      const payload = buildPropertyPayload(category, full, amenityIdByName)
      const parsed = createPropertySchema.safeParse(payload)
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
      const d = parsed.data
      expect(d.lat).toBe(location.lat)
      expect(d.city).toBe('Bengaluru')
      expect(d.images).toHaveLength(1)
      switch (category) {
        case 'apartment': expect(d.type).toBe('APARTMENT'); expect(d.rules.petsAllowed).toBe(true); expect(d.amenityIds).toContain('id-Covered Parking'); expect(d.maintenance).toBe(1500); expect(d.leaseDuration).toBe(11); expect(d.noticePeriodDays).toBe(30); expect(d.area).toBe(1100); expect(d.facingDirection).toBe('EAST'); break
        case 'house':     expect(d.type).toBe('VILLA'); expect(d.extent).toBe(2400); break
        case 'land':      expect(d.type).toBe('LAND'); expect(d.pricingModel).toBe('SALE'); expect(d.rent).toBe(4500000); expect(d.amenityIds).toContain('id-Boundary Wall'); expect(d.dimensions).toBe('30 x 40 ft'); expect(d.loanEligible).toBe(true); break
        case 'pg':        expect(d.type).toBe('PG'); expect(d.sharing).toBe(2); expect(d.rules.genderPreference).toBe('FEMALE'); expect(d.rules.curfewTime).toBe('10:30 PM'); expect(d.amenityIds).toContain('id-Breakfast'); expect(d.title).toContain('Sunrise PG'); expect(d.totalBeds).toBe(24); expect(d.availableBeds).toBe(6); expect(d.noticePeriodDays).toBe(30); break
        case 'shop':      expect(d.type).toBe('COMMERCIAL'); expect(d.commercialType).toBe('Retail shop'); expect(d.description).toContain('Restaurant'); expect(d.frontage).toBe(18); expect(d.powerLoad).toBe('15'); break
        case 'stay':      expect(d.type).toBe('SHORT_STAY'); expect(d.nightlyRate).toBe(5250); expect(d.rent).toBe(5250); expect(d.description).toContain('Check-in 2 PM'); expect(d.cleaningFee).toBe(800); expect(d.weekendRate).toBe(6500); expect(d.minNights).toBe(2); expect(d.instantBook).toBe(true); expect(d.beds).toBe(3); expect(d.rules.bachelorAllowed).toBe(true); expect(d.rules.familyPreferred).toBe(true); expect(d.rules.smokingAllowed).toBe(false); break
      }
    })
  }

  it('a flat on LEASE carries the lump sum with no deposit — and on SALE carries the buyer terms', () => {
    const base = { fields: { bhk: 2, furnished: 'FULLY' }, location, photos, photosDone: true }
    const lease = buildPropertyPayload('apartment', { ...base, fields: { ...base.fields, pricingModel: 'LEASE', rent: 800000, deposit: 56000, maintenance: 1500 } }, amenityIdByName)
    const leaseParsed = createPropertySchema.safeParse(lease)
    expect(leaseParsed.success, JSON.stringify(leaseParsed.error?.issues)).toBe(true)
    expect(leaseParsed.data.pricingModel).toBe('LEASE')
    expect(leaseParsed.data.rent).toBe(800000)
    // A typed deposit must not survive a switch to LEASE — the server rejects one.
    expect(leaseParsed.data.deposit).toBe(0)
    expect(leaseParsed.data.maintenance).toBe(1500)

    const sale = buildPropertyPayload('apartment', { ...base, fields: { ...base.fields, pricingModel: 'SALE', rent: 9500000, deposit: 200000, possessionStatus: 'Ready to move', priceNegotiable: true, loanEligible: true } }, amenityIdByName)
    const saleParsed = createPropertySchema.safeParse(sale)
    expect(saleParsed.success, JSON.stringify(saleParsed.error?.issues)).toBe(true)
    expect(saleParsed.data.pricingModel).toBe('SALE')
    expect(saleParsed.data.rent).toBe(9500000)
    expect(saleParsed.data.possessionStatus).toBe('Ready to move')
    expect(saleParsed.data.loanEligible).toBe(true)
    // The deposit question is hidden on LEASE, and the lease terms hide on SALE.
    expect(missingRequired('apartment', { ...base, fields: { ...base.fields, pricingModel: 'LEASE', rent: 800000 } })).toEqual([])
  })

  it('a lease on land is the RENT pricing model with saleOrLease=LEASE — LEASE itself is refused on land', () => {
    const full = { fields: { saleOrLease: 'LEASE', extent: 2, extentUnit: 'acres', rent: 120000, deposit: 50000, landType: 'Agricultural', approvalStatus: 'Panchayat' }, location, photos, photosDone: true }
    const parsed = createPropertySchema.safeParse(buildPropertyPayload('land', full, amenityIdByName))
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    expect(parsed.data.pricingModel).toBe('RENT')
    expect(parsed.data.saleOrLease).toBe('LEASE')
    expect(parsed.data.deposit).toBe(50000)
    // And the advance is only asked on a lease.
    expect(nextQuestion('land', { fields: { saleOrLease: 'SALE', extent: 1, extentUnit: 'sq.ft', rent: 1 }, location }).id).toBe('priceNegotiable')
  })

  it('folds booleans into amenities without inventing names', () => {
    expect(amenityNames('apartment', { parking: true })).toEqual(['Covered Parking'])
    expect(amenityNames('pg', { foodIncluded: true, amenities: ['WiFi'] })).toEqual(['WiFi', 'Breakfast', 'Lunch', 'Dinner'])
    expect(amenityNames('land', { boundaryWall: false })).toEqual([])
  })
})
