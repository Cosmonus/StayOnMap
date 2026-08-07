/**
 * SIMILAR_TO — 2026-08-07
 *
 * The property that decides whether this feature helps or embarrasses us:
 * StayOnMap lists SIX categories, and "similar" is a different question for each.
 * A scorer that compares `bhk` and `rent` is silently wrong for four of them.
 *
 * Two gates run before any scoring, and both produce a CONFIDENTLY wrong
 * recommendation when broken rather than a weak one:
 *   1. comparable type only — a plot is never similar to a flat
 *   2. same pricing model — `rent` is a monthly rent on RENT and a lakh-scale
 *      lump sum on LEASE/SALE; mixing them averages ₹28,000 with ₹80,00,000
 */
import { describe, it, expect } from 'vitest'
import { score, comparableTypes, TOP_K } from '../src/features/graph/similarity.js'

// Two points ~1.1km apart in Koramangala.
const HERE = { lat: 12.9352, lng: 77.6245 }
const NEAR = { lat: 12.9452, lng: 77.6245 }
const FAR = { lat: 13.0827, lng: 80.2707 } // Chennai

const flat = (over = {}) => ({
  id: 'a', type: 'APARTMENT', pricingModel: 'RENT', status: 'ACTIVE',
  ...HERE, city: 'Bengaluru', localityId: 'loc1',
  rent: 30000, bhk: 2, furnished: 'SEMI', ...over,
})

describe('comparableTypes — what may be compared with what', () => {
  it('lets the four residential styles substitute for each other', () => {
    // Somebody choosing between a villa and an independent house is choosing
    // between two homes.
    expect(comparableTypes('APARTMENT')).toContain('VILLA')
    expect(comparableTypes('VILLA')).toContain('INDEPENDENT_HOUSE')
  })

  it('makes every non-residential type an island', () => {
    // Nothing substitutes for a plot except another plot.
    expect(comparableTypes('LAND')).toEqual(['LAND'])
    expect(comparableTypes('PG')).toEqual(['PG'])
    expect(comparableTypes('COMMERCIAL')).toEqual(['COMMERCIAL'])
    expect(comparableTypes('SHORT_STAY')).toEqual(['SHORT_STAY'])
  })
})

describe('the two hard gates', () => {
  it('never calls a plot similar to a flat', () => {
    expect(score(flat(), flat({ id: 'b', type: 'LAND' }))).toBeNull()
  })

  it('never compares a SALE price with a monthly rent', () => {
    // Same coordinates, same everything — only the money means something else.
    expect(score(flat(), flat({ id: 'b', pricingModel: 'SALE' }))).toBeNull()
    expect(score(flat(), flat({ id: 'b', pricingModel: 'LEASE' }))).toBeNull()
  })

  it('never scores a listing against itself', () => {
    expect(score(flat(), flat())).toBeNull()
  })

  it('drops a candidate beyond the type\'s radius', () => {
    expect(score(flat(), flat({ id: 'b', ...FAR, city: 'Chennai' }))).toBeNull()
  })

  it('allows a plot a wider radius than a PG bed', () => {
    // 15km is inside LAND's radius and far outside PG's — the same distance,
    // two different answers, which is the whole point of per-type radii.
    const far = { lat: 13.0652, lng: 77.6245 } // ~14.4km north
    const land = { id: 'a', type: 'LAND', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', extent: 2400, landType: 'Residential', rent: 5000000 }
    const pg = { id: 'a', type: 'PG', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', sharing: 2, rent: 12000 }

    expect(score(land, { ...land, id: 'b', ...far })).not.toBeNull()
    expect(score(pg, { ...pg, id: 'b', ...far })).toBeNull()
  })
})

describe('per-type scoring reads the right dimension', () => {
  it('scores a PG on sharing, not on bedrooms', () => {
    const pg = { id: 'a', type: 'PG', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', sharing: 2, rent: 12000, furnished: 'FULLY' }
    const same = score(pg, { ...pg, id: 'b', ...NEAR })
    const crowded = score(pg, { ...pg, id: 'c', ...NEAR, sharing: 6 })

    expect(same.score).toBeGreaterThan(crowded.score)
    expect(same.reasons).toHaveProperty('size')
  })

  it('scores a plot on extent and approval status', () => {
    const plot = { id: 'a', type: 'LAND', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', extent: 2400, landType: 'Residential', approvalStatus: 'DTCP', rent: 5000000 }
    const alike = score(plot, { ...plot, id: 'b', ...NEAR })
    const unapproved = score(plot, { ...plot, id: 'c', ...NEAR, approvalStatus: 'Unapproved' })

    // B-khata/unapproved is a financing difference, not a cosmetic one.
    expect(alike.score).toBeGreaterThan(unapproved.score)
  })

  it('scores a short stay on its NIGHTLY rate, not the monthly field', () => {
    const stay = { id: 'a', type: 'SHORT_STAY', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', maxGuests: 4, nightlyRate: 2500, rent: 2500, placeType: 'Entire place' }
    // Same nightly rate, wildly different `rent` — must not matter.
    const twin = score(stay, { ...stay, id: 'b', ...NEAR, rent: 999999 })
    const pricier = score(stay, { ...stay, id: 'c', ...NEAR, nightlyRate: 9000, rent: 9000 })

    expect(twin.score).toBeGreaterThan(pricier.score)
  })

  it('scores a shop on carpet area and commercial type', () => {
    const shop = { id: 'a', type: 'COMMERCIAL', pricingModel: 'RENT', ...HERE, city: 'Bengaluru', carpetArea: 600, commercialType: 'Retail shop', rent: 80000 }
    const alike = score(shop, { ...shop, id: 'b', ...NEAR })
    const warehouse = score(shop, { ...shop, id: 'c', ...NEAR, commercialType: 'Warehouse', carpetArea: 5000 })

    expect(alike.score).toBeGreaterThan(warehouse.score)
  })
})

describe('missing data is skipped, not scored as zero', () => {
  it('drops the price component instead of penalising a listing with no price', () => {
    const result = score(flat(), flat({ id: 'b', ...NEAR, rent: null }))
    expect(result.reasons).not.toHaveProperty('price')
    expect(result.reasons.skipped).toContain('price')
  })

  it('does not rank a blank field below a genuinely different one', () => {
    // A listing with no bedroom count recorded must not lose to one that
    // records a very different count — absence is a data-entry artefact, not a
    // fact about the property.
    const blank = score(flat(), flat({ id: 'b', ...NEAR, bhk: null }))
    const different = score(flat(), flat({ id: 'c', ...NEAR, bhk: 6 }))
    expect(blank.score).toBeGreaterThan(different.score)
  })

  it('returns null when nothing at all can be compared', () => {
    const bare = { id: 'a', type: 'APARTMENT', pricingModel: 'RENT' }
    expect(score(bare, { ...bare, id: 'b' })).toBeNull()
  })
})

describe('the score is explainable', () => {
  it('reports every component it used and every one it skipped', () => {
    const result = score(flat(), flat({ id: 'b', ...NEAR }))
    expect(Object.keys(result.reasons).sort())
      .toEqual(['attributes', 'location', 'price', 'size', 'skipped'])
    expect(result.reasons.skipped).toEqual([])
  })

  it('rewards the same resolved locality over raw distance alone', () => {
    const sameArea = score(flat(), flat({ id: 'b', ...NEAR, localityId: 'loc1' }))
    const otherArea = score(flat(), flat({ id: 'c', ...NEAR, localityId: 'loc2' }))
    expect(sameArea.reasons.location).toBeGreaterThan(otherArea.reasons.location)
  })

  it('stays within 0..1 and is deterministic', () => {
    const a = score(flat(), flat({ id: 'b', ...NEAR }))
    const b = score(flat(), flat({ id: 'b', ...NEAR }))
    expect(a).toEqual(b)
    expect(a.score).toBeGreaterThanOrEqual(0)
    expect(a.score).toBeLessThanOrEqual(1)
  })

  it('an identical twin next door outscores a further, different listing', () => {
    const twin = score(flat(), flat({ id: 'b', lat: 12.9353, lng: 77.6246 }))
    // ~4km out — inside the residential radius, so this is a comparison of
    // scores rather than of the radius gate (which the gate tests already cover).
    const other = score(flat(), flat({
      id: 'c', lat: 12.9652, lng: 77.6445,
      rent: 90000, bhk: 4, furnished: 'UNFURNISHED', localityId: 'loc9',
    }))
    expect(other).not.toBeNull()
    expect(twin.score).toBeGreaterThan(other.score)
  })
})

describe('TOP_K', () => {
  it('keeps a page-sized neighbourhood, not the whole city', () => {
    expect(TOP_K).toBeGreaterThan(0)
    expect(TOP_K).toBeLessThanOrEqual(24)
  })
})
