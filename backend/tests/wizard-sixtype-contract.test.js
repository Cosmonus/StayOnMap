/**
 * Wizard → backend six-type contract — 2026-07-22
 *
 * Proves that ALL 6 listing categories (apartment, house, land, pg, shop,
 * stay) complete the full listing flow: a complete wizard draft passes
 * missingRequirements(), and the payload buildPayload() produces from it is
 * ACCEPTED by the backend's real createPropertySchema. This imports the
 * FRONTEND config directly — buildPayload/missingRequirements/deriveType live
 * in frontend/src/features/listings/config/onboarding.js (pure JS, no
 * imports), the same copy both platforms' wizards run.
 *
 * If a category fails here, the wizard can build a listing its own backend
 * rejects at publish. Fix the wizard payload or the config — NEVER weaken the
 * backend schema to make this pass.
 */
import { describe, it, expect } from 'vitest'
import {
  CATEGORIES,
  DESCRIBE,
  FIELDS,
  RULES,
  TERMS,
  SALE_CATEGORIES,
  LAND_RECORD_FIELD_KEYS,
  defaultRules,
  pricingModes,
  resolveMode,
  termRows,
  LEASE_CATEGORIES,
  BUSINESS_GATED_TYPES as WIZARD_GATED_CATEGORIES,
  pricingRows,
  missingRequirements,
  deriveType,
  buildPayload,
} from '../../frontend/src/features/listings/config/onboarding.js'
import { createPropertySchema, LEASE_ELIGIBLE_TYPES, SALE_ELIGIBLE_TYPES } from '../src/features/properties/properties.validation.js'
import { BUSINESS_GATED_TYPES as BACKEND_GATED_TYPES } from '../src/middlewares/requireBusiness.middleware.js'

const CATEGORY_KEYS = ['apartment', 'house', 'land', 'pg', 'shop', 'stay']

// A realistic, COMPLETE draft per category — values shaped exactly the way
// the wizard's controls store them (text inputs as strings, steppers and
// describe choices as their raw option values).
const location = {
  address: '12, 4th Cross, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
  landmark: 'Near the metro station',
  lat: 12.9716,
  lng: 77.5946,
}

function makeDraft(overrides) {
  return {
    fields: {},
    amenityNames: [],
    rules: {},
    terms: {},
    zeroBrokerage: true,
    brokerage: '',
    location,
    images: ['https://example.com/photo-1.jpg'],
    title: 'A realistic listing title',
    description: 'A description comfortably over the ten character minimum.',
    pricingModel: 'RENT',
    pricing: {},
    appointmentWindowStart: '',
    appointmentWindowEnd: '',
    instantBook: false,
    blockedDates: [],
    ...overrides,
  }
}

const COMPLETE_DRAFTS = {
  apartment: makeDraft({
    fields: { bhk: 2, bathrooms: 2, furnished: 'SEMI', floor: '4', totalFloors: '12', area: '1100', facingDirection: 'EAST' },
    title: 'Bright 2 BHK near Indiranagar metro',
    pricing: { rent: '28000', deposit: '56000', maintenance: '1500' },
  }),
  house: makeDraft({
    fields: { houseStyle: 'Independent house', bhk: 3, bathrooms: 3, extent: '2400', area: '1800', furnished: 'UNFURNISHED' },
    title: '3 BHK independent house with garden',
    pricing: { rent: '45000', deposit: '200000', maintenance: '0' },
  }),
  land: makeDraft({
    fields: { landType: 'Residential', saleOrLease: 'SALE', extent: '2400', extentUnit: 'sq.ft', dimensions: '40 x 60 ft', roadWidth: '30', approvalStatus: 'DTCP' },
    title: '2400 sq.ft east-facing plot on 30 ft road',
    pricing: { rent: '4500000', deposit: '100000' },
  }),
  pg: makeDraft({
    fields: { sharing: 2, genderPreference: 'FEMALE', totalBeds: '24', availableBeds: '6', noticePeriodDays: '30' },
    title: '2-sharing PG for women with food',
    pricing: { rent: '9500', deposit: '19000' },
  }),
  shop: makeDraft({
    fields: { commercialType: 'Retail shop', carpetArea: '850', frontage: '18', floor: '0', powerLoad: '15' },
    title: 'Ground-floor shop with main road frontage',
    pricing: { rent: '85000', deposit: '510000' },
  }),
  stay: makeDraft({
    fields: { placeType: 'Entire place', maxGuests: 4, bhk: '2', beds: '3', bathrooms: 2 },
    title: 'Cosy 2 BHK near the beach, sleeps 4',
    pricing: { nightlyRate: '5250', cleaningFee: '800', weekendRate: '6500' },
    instantBook: true,
  }),
}

function payloadFor(categoryKey, draft = COMPLETE_DRAFTS[categoryKey]) {
  const type = deriveType(categoryKey, draft.fields[DESCRIBE[categoryKey].k])
  return buildPayload(categoryKey, type, draft, ['amenity-1', 'amenity-2'])
}

describe('wizard six-type contract — complete drafts', () => {
  it('covers exactly the 6 wizard categories', () => {
    expect(Object.keys(CATEGORIES).sort()).toEqual([...CATEGORY_KEYS].sort())
    expect(Object.keys(COMPLETE_DRAFTS).sort()).toEqual([...CATEGORY_KEYS].sort())
  })

  it.each(CATEGORY_KEYS)('%s: complete draft has no missing requirements', (key) => {
    expect(missingRequirements(key, COMPLETE_DRAFTS[key])).toEqual([])
  })

  it.each(CATEGORY_KEYS)('%s: drafts only use fields the category actually offers', (key) => {
    // Guards the fixtures themselves: every draft field must come from the
    // describe step or FIELDS[key], so this suite can't pass on inputs the
    // real wizard could never produce.
    const offered = new Set([DESCRIBE[key].k])
    if (key === 'land') LAND_RECORD_FIELD_KEYS.forEach((k) => offered.add(k))
    for (const row of FIELDS[key]) {
      if (row.field) offered.add(row.field)
      if (row.a) offered.add(row.a[0])
      if (row.b) offered.add(row.b[0])
    }
    for (const fieldKey of Object.keys(COMPLETE_DRAFTS[key].fields)) {
      expect(offered.has(fieldKey), `${key} draft uses un-offered field ${fieldKey}`).toBe(true)
    }
  })

  it.each(CATEGORY_KEYS)('%s: buildPayload output is ACCEPTED by createPropertySchema', (key) => {
    const r = createPropertySchema.safeParse(payloadFor(key))
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true)
  })
})

describe('wizard six-type contract — incomplete drafts surface at review', () => {
  it.each(CATEGORY_KEYS)('%s: no photos → a photos entry', (key) => {
    const missing = missingRequirements(key, { ...COMPLETE_DRAFTS[key], images: [] })
    expect(missing).toEqual([{ stepK: 'photos', label: 'Add at least one photo' }])
  })

  it.each(CATEGORY_KEYS)('%s: short title + no pin → features and location entries', (key) => {
    const draft = {
      ...COMPLETE_DRAFTS[key],
      title: 'Hi',
      location: { ...location, lat: null, lng: null },
    }
    const missing = missingRequirements(key, draft)
    expect(missing.map((m) => m.stepK).sort()).toEqual(['features', 'location'])
  })

  it.each(CATEGORY_KEYS)('%s: unanswered describe question → a basics entry', (key) => {
    const fields = { ...COMPLETE_DRAFTS[key].fields }
    delete fields[DESCRIBE[key].k]
    const missing = missingRequirements(key, { ...COMPLETE_DRAFTS[key], fields })
    expect(missing.some((m) => m.stepK === 'basics')).toBe(true)
  })

  it.each(CATEGORY_KEYS)('%s: empty required price → a pricing entry per required row', (key) => {
    const missing = missingRequirements(key, { ...COMPLETE_DRAFTS[key], pricing: {} })
    const requiredRows = pricingRows(key, 'RENT').filter(([k]) => !['deposit', 'maintenance', 'cleaningFee', 'weekendRate'].includes(k))
    expect(missing.filter((m) => m.stepK === 'pricing')).toHaveLength(requiredRows.length)
  })
})

describe('wizard six-type contract — house type derivation', () => {
  it('maps all 4 describe choices to real PropertyType values', () => {
    expect(deriveType('house', 'Independent house')).toBe('INDEPENDENT_HOUSE')
    expect(deriveType('house', 'Villa')).toBe('VILLA')
    expect(deriveType('house', 'Duplex')).toBe('HOUSE')
    expect(deriveType('house', 'Row house')).toBe('HOUSE')
  })

  it.each(['Independent house', 'Villa', 'Duplex', 'Row house'])(
    'house draft with %s passes the schema with houseStyle preserved',
    (style) => {
      const draft = { ...COMPLETE_DRAFTS.house, fields: { ...COMPLETE_DRAFTS.house.fields, houseStyle: style } }
      const r = createPropertySchema.safeParse(payloadFor('house', draft))
      expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
      expect(r.data.houseStyle).toBe(style)
      expect(r.data.type).toBe(deriveType('house', style))
    }
  )
})

describe('wizard six-type contract — lease pricing mode', () => {
  const LEASE_PRICING_FIXTURES = {
    apartment: { rent: '800000', maintenance: '1500' },
    house: { rent: '1500000', maintenance: '0' },
    shop: { rent: '2500000' },
  }

  it('LEASE_CATEGORIES is exactly apartment/house/shop', () => {
    expect([...LEASE_CATEGORIES].sort()).toEqual(['apartment', 'house', 'shop'])
  })

  it.each(LEASE_CATEGORIES)('%s: lease draft is complete, and its payload passes with deposit 0', (key) => {
    const draft = { ...COMPLETE_DRAFTS[key], pricingModel: 'LEASE', pricing: LEASE_PRICING_FIXTURES[key] }
    expect(missingRequirements(key, draft)).toEqual([])

    const payload = payloadFor(key, draft)
    expect(payload.pricingModel).toBe('LEASE')
    expect(payload.deposit).toBe(0)
    expect(payload.rent).toBe(Number(LEASE_PRICING_FIXTURES[key].rent))

    const r = createPropertySchema.safeParse(payload)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('every type a lease category can derive to is lease-eligible on the backend', () => {
    for (const key of LEASE_CATEGORIES) {
      for (const [value] of DESCRIBE[key].opts) {
        const type = deriveType(key, value)
        expect(LEASE_ELIGIBLE_TYPES, `${key}/${value} derives ${type}`).toContain(type)
      }
    }
  })
})

describe('wizard six-type contract — business gate coverage', () => {
  it('the wizard-gated categories map onto exactly the backend-gated types', () => {
    const gatedTypes = WIZARD_GATED_CATEGORIES.map((key) => CATEGORIES[key].type)
    expect(gatedTypes.sort()).toEqual([...BACKEND_GATED_TYPES].sort())
    expect(WIZARD_GATED_CATEGORIES.sort()).toEqual(['pg', 'shop', 'stay'])
  })
})

describe('wizard six-type contract — short-stay specifics', () => {
  it('carries nightlyRate/minNights/maxNights/instantBook and passes', () => {
    const r = createPropertySchema.safeParse(payloadFor('stay'))
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
    expect(r.data.nightlyRate).toBe(5250)
    expect(r.data.rent).toBe(5250) // rent mirrors nightlyRate — pins/cards read rent
    expect(r.data.cleaningFee).toBe(800)
    expect(r.data.weekendRate).toBe(6500)
    expect(r.data.minNights).toBe(1)
    expect(r.data.maxNights).toBe(28)
    expect(r.data.instantBook).toBe(true)
    expect(r.data.placeType).toBe('Entire place')
  })
})

describe('wizard six-type contract — payload details the map relies on', () => {
  it('pg gender preference travels as a rules object, not a column', () => {
    const r = createPropertySchema.safeParse(payloadFor('pg'))
    expect(r.success).toBe(true)
    expect(r.data.rules).toEqual(expect.objectContaining({ genderPreference: 'FEMALE' }))
    expect(r.data.genderPreference).toBeUndefined()
  })

  it('land keeps saleOrLease and repurposes rent/deposit as price/advance', () => {
    const r = createPropertySchema.safeParse(payloadFor('land'))
    expect(r.success).toBe(true)
    expect(r.data.saleOrLease).toBe('SALE')
    expect(r.data.rent).toBe(4500000)
    expect(r.data.deposit).toBe(100000)
    expect(r.data.extent).toBe(2400)
  })

  it('shop keeps powerLoad as a string and floor as a number', () => {
    const r = createPropertySchema.safeParse(payloadFor('shop'))
    expect(r.success).toBe(true)
    expect(r.data.powerLoad).toBe('15')
    expect(r.data.floor).toBe(0)
  })
})

// Everything below guards the 2026-07-26 six-step rework: the specs, rules and
// terms each type collects, and that they survive the trip to the schema.
describe('wizard six-type contract — per-type specs, rules and terms', () => {
  it.each(CATEGORY_KEYS)('%s: declares its own spec set, rules and terms', (key) => {
    expect(FIELDS[key].length).toBeGreaterThan(0)
    expect(RULES[key]).toBeDefined()
    expect(TERMS[key].length).toBeGreaterThan(0)
  })

  it('land and commercial declare NO house rules — hidden, not caveated', () => {
    expect(RULES.land).toEqual([])
    expect(RULES.shop).toEqual([])
  })

  it.each(['apartment', 'house', 'pg', 'stay'])('%s: default rules reach the payload', (key) => {
    const draft = { ...COMPLETE_DRAFTS[key], rules: defaultRules(key) }
    const r = createPropertySchema.safeParse(payloadFor(key, draft))
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
    for (const rule of RULES[key]) {
      if (rule.t === 'time') continue
      expect(r.data.rules[rule.k], `${key}.${rule.k}`).toBe(rule.def)
    }
  })

  it('a rule the owner flips travels as the flipped value', () => {
    const draft = { ...COMPLETE_DRAFTS.apartment, rules: { ...defaultRules('apartment'), petsAllowed: true, bachelorAllowed: false } }
    const r = createPropertySchema.safeParse(payloadFor('apartment', draft))
    expect(r.success).toBe(true)
    expect(r.data.rules.petsAllowed).toBe(true)
    expect(r.data.rules.bachelorAllowed).toBe(false)
  })

  it('an empty PG curfew is omitted entirely — that is what "no curfew" filters on', () => {
    const withCurfew = payloadFor('pg', { ...COMPLETE_DRAFTS.pg, rules: { ...defaultRules('pg'), curfewTime: '22:30' } })
    const without = payloadFor('pg', { ...COMPLETE_DRAFTS.pg, rules: defaultRules('pg') })
    expect(withCurfew.rules.curfewTime).toBe('22:30')
    expect(without.rules.curfewTime).toBeUndefined()
    expect(createPropertySchema.safeParse(withCurfew).success).toBe(true)
  })

  it('availableFrom reaches the schema as an ISO datetime (the availableBy filter reads it)', () => {
    const draft = { ...COMPLETE_DRAFTS.apartment, terms: { availableFrom: '2026-08-01', leaseDuration: '11' } }
    const r = createPropertySchema.safeParse(payloadFor('apartment', draft))
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
    expect(r.data.availableFrom).toBe('2026-08-01T00:00:00.000Z')
    expect(r.data.leaseDuration).toBe(11)
  })

  it('stay night limits come from the owner, and fall back to 1/28 when left empty', () => {
    const set = payloadFor('stay', { ...COMPLETE_DRAFTS.stay, terms: { minNights: '2', maxNights: '90' } })
    expect(set.minNights).toBe(2)
    expect(set.maxNights).toBe(90)
    expect(createPropertySchema.safeParse(set).success).toBe(true)

    const unset = payloadFor('stay')
    expect(unset.minNights).toBe(1)
    expect(unset.maxNights).toBe(28)
  })

  it.each(CATEGORY_KEYS)('%s: brokerage is 0 unless the owner says they charge one', (key) => {
    expect(payloadFor(key).brokerage).toBe(0)
    const charging = payloadFor(key, { ...COMPLETE_DRAFTS[key], zeroBrokerage: false, brokerage: '15000' })
    expect(charging.brokerage).toBe(15000)
    expect(createPropertySchema.safeParse(charging).success).toBe(true)
  })
})

// ── For sale ────────────────────────────────────────────────────────────
// Added 2026-07-26 with the SALE pricing mode. Flats, houses, shops and plots
// can be sold outright; a PG bed and a nightly stay cannot.
describe('wizard six-type contract — sale mode', () => {
  const SALE_FIXTURES = {
    apartment: { rent: '45000000', deposit: '500000', maintenance: '1500' },
    house: { rent: '18000000', deposit: '500000' },
    shop: { rent: '25000000', deposit: '500000' },
    land: { rent: '8500000', deposit: '200000' },
  }

  function saleDraft(key) {
    return {
      ...COMPLETE_DRAFTS[key],
      pricingModel: 'SALE',
      pricing: SALE_FIXTURES[key],
      terms: {
        availableFrom: '2026-09-01',
        priceNegotiable: true,
        loanEligible: true,
        ...(key === 'land' ? {} : { possessionStatus: 'Ready to move' }),
      },
      // Land declares sale through its own first spec question, not the picker.
      ...(key === 'land' ? { fields: { ...COMPLETE_DRAFTS.land.fields, saleOrLease: 'SALE' } } : {}),
    }
  }

  it('SALE_CATEGORIES maps onto exactly the backend-eligible types', () => {
    expect([...SALE_CATEGORIES].sort()).toEqual(['apartment', 'house', 'land', 'shop'])
    for (const key of SALE_CATEGORIES) {
      for (const [value] of DESCRIBE[key].opts) {
        expect(SALE_ELIGIBLE_TYPES, `${key}/${value}`).toContain(deriveType(key, value))
      }
    }
  })

  it('offers no sale mode for a PG bed or a nightly stay', () => {
    expect(pricingModes('pg')).toEqual(['RENT'])
    expect(pricingModes('stay')).toEqual(['RENT'])
  })

  it.each(SALE_CATEGORIES)('%s: a complete sale draft is accepted by the backend', (key) => {
    const draft = saleDraft(key)
    expect(missingRequirements(key, draft)).toEqual([])

    const payload = payloadFor(key, draft)
    expect(payload.pricingModel).toBe('SALE')
    expect(payload.rent).toBe(Number(SALE_FIXTURES[key].rent))
    // On a sale `deposit` is the booking advance — kept, unlike on a lease.
    expect(payload.deposit).toBe(Number(SALE_FIXTURES[key].deposit))
    expect(payload.availableFrom).toBe('2026-09-01T00:00:00.000Z')
    expect(payload.priceNegotiable).toBe(true)
    expect(payload.loanEligible).toBe(true)

    const r = createPropertySchema.safeParse(payload)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true)
  })

  it('a crore-scale price is a valid ASKING price and an invalid rent', () => {
    const sale = createPropertySchema.safeParse(payloadFor('apartment', saleDraft('apartment')))
    expect(sale.success).toBe(true)
    expect(sale.data.rent).toBe(45000000)

    // Same number, rent mode: caught rather than published as ₹4.5Cr a month.
    const asRent = createPropertySchema.safeParse(
      payloadFor('apartment', { ...COMPLETE_DRAFTS.apartment, pricing: { rent: '45000000', deposit: '0' } })
    )
    expect(asRent.success).toBe(false)
  })

  it('rental-only terms never ride along onto a sale', () => {
    const payload = payloadFor('apartment', saleDraft('apartment'))
    expect(payload.leaseDuration).toBeUndefined()
    expect(termRows('apartment', 'SALE').map((t) => t.k)).not.toContain('leaseDuration')
    // ...and sale-only fields never ride along onto a rental.
    const rental = payloadFor('apartment')
    expect(rental.possessionStatus).toBeUndefined()
    expect(rental.loanEligible).toBeUndefined()
    expect(rental.priceNegotiable).toBeUndefined()
  })

  it('land derives its mode from saleOrLease, never from the picker', () => {
    expect(pricingModes('land')).toEqual([])
    const forSale = { ...COMPLETE_DRAFTS.land, fields: { ...COMPLETE_DRAFTS.land.fields, saleOrLease: 'SALE' } }
    const forLease = { ...COMPLETE_DRAFTS.land, fields: { ...COMPLETE_DRAFTS.land.fields, saleOrLease: 'LEASE' } }
    expect(resolveMode('land', forSale)).toBe('SALE')
    // RENT, not LEASE: a let plot is paid periodically, and the backend rejects
    // LEASE for LAND (LEASE means the refundable lump-sum deal).
    expect(resolveMode('land', forLease)).toBe('RENT')
    expect(payloadFor('land', forLease).pricingModel).toBe('RENT')
    expect(createPropertySchema.safeParse(payloadFor('land', forLease)).success).toBe(true)
  })

  it('every mode a category offers is one the backend accepts for it', () => {
    for (const key of Object.keys(CATEGORIES)) {
      for (const mode of pricingModes(key)) {
        const draft = mode === 'SALE' ? saleDraft(key) : { ...COMPLETE_DRAFTS[key], pricingModel: mode, pricing: mode === 'LEASE' ? { rent: '800000' } : COMPLETE_DRAFTS[key].pricing }
        const r = createPropertySchema.safeParse(payloadFor(key, draft))
        expect(r.success, `${key} in ${mode}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true)
      }
    }
  })
})

// ── Indian land records ─────────────────────────────────────────────────
describe('wizard six-type contract — land records', () => {
  const RECORDS = {
    surveyNumber: 'Sy. No. 12/3B',
    subdivisionNumber: '2A',
    landRecordType: 'A-khata',
    landRecordNumber: 'BBMP/2019/4412',
    conversionStatus: 'Converted',
    ecAvailable: true,
    ecYears: '30',
    guidelineValue: '3200',
  }

  it('a plot carrying its state record passes the backend schema', () => {
    const draft = { ...COMPLETE_DRAFTS.land, fields: { ...COMPLETE_DRAFTS.land.fields, ...RECORDS } }
    const payload = payloadFor('land', draft)

    // Text stays verbatim (a survey number is "12/3B" in one district and
    // "Sy.No. 45, Blk 2" in the next); the two numerics are coerced.
    expect(payload.surveyNumber).toBe('Sy. No. 12/3B')
    expect(payload.landRecordType).toBe('A-khata')
    expect(payload.ecAvailable).toBe(true)
    expect(payload.ecYears).toBe(30)
    expect(payload.guidelineValue).toBe(3200)

    const r = createPropertySchema.safeParse(payload)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true)
  })

  it('records are optional — a plot with none is still publishable', () => {
    expect(missingRequirements('land', COMPLETE_DRAFTS.land)).toEqual([])
    expect(createPropertySchema.safeParse(payloadFor('land')).success).toBe(true)
  })

  it('ecAvailable false is sent, not dropped — "I have no EC" is an answer', () => {
    const draft = { ...COMPLETE_DRAFTS.land, fields: { ...COMPLETE_DRAFTS.land.fields, ecAvailable: false } }
    expect(payloadFor('land', draft).ecAvailable).toBe(false)
  })
})
