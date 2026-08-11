// Attribute-level confidence and the POI TrustScore.
//
// The score is a measurement of OUR KNOWLEDGE of a place, never of the place.
// Most of what is pinned here is that distinction holding under pressure: a
// well-mapped hospital with no phone number must not score below a random shop
// that has one, and a record nobody has ever checked must not read as a record
// that failed a check.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  attributeConfidence, poiTrustScore, verifyByPincode,
  conflictMultiplier, ATTRIBUTES, CORE_ATTRIBUTES,
} from '../src/features/spatial/poiTrust.js'
import { POI_SOURCES, sourceFor, isPersistable, canAssert } from '../src/features/spatial/poiSources.js'
import { statesOfMetro, SUPPORTED_CITIES } from '../src/config/cities.js'
import { scorePoiBatch, runPoiScoringTick } from '../src/features/spatial/poiScoring.service.js'

const NOW = new Date('2026-08-11T00:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

// A well-mapped Koramangala pharmacy, fetched yesterday.
const poi = (over = {}) => ({
  id: 'p1', osmId: 'node/1', category: 'pharmacy',
  name: 'Apollo Pharmacy', brand: 'Apollo', openingHours: 'Mo-Su 09:00-22:00',
  phone: '+918012345678', website: 'https://apollopharmacy.in',
  address: '12, 80 Feet Road, Koramangala', postcode: '560095',
  lat: 12.9352, lng: 77.6245, city: 'Bengaluru',
  status: 'ACTIVE', fetchedAt: daysAgo(1),
  verificationStatus: 'UNVERIFIED', verificationMethod: null,
  ...over,
})

const ctx = (over = {}) => ({ now: NOW, ...over })

// ── Sources ─────────────────────────────────────────────────────────────────

describe('poiSources', () => {
  it('records the licence alongside the reliability', () => {
    // A source added without checking its terms is how a licence breach ships
    // as a schema change, so the two live together.
    for (const [id, s] of Object.entries(POI_SOURCES)) {
      expect(s.licence, `${id} has no licence`).toBeTruthy()
      expect(typeof s.persistable).toBe('boolean')
    }
  })

  it('marks Google as query-only — it must never reach our tables', () => {
    expect(isPersistable('google_places')).toBe(false)
    expect(isPersistable('osm')).toBe(true)
  })

  it('treats an unknown source as untrusted and unstorable', () => {
    // A source nobody wrote down is a source nobody checked the terms of.
    expect(isPersistable('some_scraper')).toBe(false)
    expect(sourceFor('some_scraper').reliability).toBeLessThan(0.5)
  })

  it('keeps a source inside its competence', () => {
    // India Post knows a pincode's district and nothing about opening hours.
    expect(canAssert('india_post', 'address')).toBe(true)
    expect(canAssert('india_post', 'hours')).toBe(false)
  })
})

// ── Attribute confidence ────────────────────────────────────────────────────

describe('attributeConfidence', () => {
  it('reports an absent attribute as absent, not as doubted', () => {
    // The distinction the whole dashboard rests on: "we don't know" and "we
    // don't believe it" are different findings.
    const r = attributeConfidence('contact', poi({ phone: null, website: null }), ctx())
    expect(r.present).toBe(false)
    expect(r.value).toBe(0)
    expect(r.basis).toMatch(/hold no value/)
    expect(r.factors).toEqual([])
  })

  it('starts from the source\'s reliability when nothing reduces it', () => {
    const r = attributeConfidence('location', poi(), ctx())
    expect(r.value).toBe(POI_SOURCES.osm.reliability)
    expect(r.factors.every((f) => !f.applied)).toBe(true)
  })

  it('ages hours faster than the place they belong to', () => {
    // A hospital does not move; its OPD timings change with the season.
    const old = poi({ category: 'hospital', fetchedAt: daysAgo(200) })
    expect(attributeConfidence('hours', old, ctx()).value)
      .toBeLessThan(attributeConfidence('location', old, ctx()).value)
  })

  it('lets the first disagreement pass and penalises the rest', () => {
    // A single correction is evidence the source is IMPROVING. Penalising it
    // would score a corrected record below one nobody has ever revisited,
    // which rewards neglect.
    expect(conflictMultiplier(0)).toBe(1)
    expect(conflictMultiplier(1)).toBe(1)
    expect(conflictMultiplier(2)).toBeLessThan(1)
    expect(conflictMultiplier(99)).toBe(0.7) // floored, never worthless
  })

  it('attributes a disagreement only to the attribute it was about', () => {
    // A place being reclassified says nothing about whether its coordinates
    // are right.
    const c = ctx({ conflictCounts: { category: 5 } })
    expect(attributeConfidence('category', poi(), c).value)
      .toBeLessThan(attributeConfidence('location', poi(), c).value)
  })

  it('CAPS rather than scales when we serve a coordinate the source contradicts', () => {
    // We know this is worse and not by how much: the withheld jump might have
    // been vandalism (we are right) or a real relocation we refused (we are
    // wrong), and nothing in the row says which. Inventing a magnitude there
    // is the authored-number problem this layer exists to avoid.
    const r = attributeConfidence('location', poi(), ctx({ locationWithheld: true }))
    expect(r.value).toBeLessThanOrEqual(0.6)
    expect(r.factors.find((f) => f.key === 'withheld_move').cap).toBe(0.6)
    expect(r.factors.find((f) => f.key === 'withheld_move').multiplier).toBeNull()
  })

  it('drops hard for a place the source no longer lists', () => {
    const r = attributeConfidence('location', poi({ status: 'ABSENT_FROM_SOURCE' }), ctx())
    expect(r.value).toBeLessThanOrEqual(0.3)
  })

  it('penalises a POI that keeps appearing and disappearing', () => {
    const steady = attributeConfidence('location', poi(), ctx({ statusEventCount: 1 }))
    const flapping = attributeConfidence('location', poi(), ctx({ statusEventCount: 5 }))
    expect(flapping.value).toBeLessThan(steady.value)
  })

  it('gives every applied factor a reason a person could read', () => {
    const r = attributeConfidence('location', poi({ fetchedAt: daysAgo(900) }), ctx({
      conflictCounts: { location: 4 }, statusEventCount: 6,
    }))
    for (const f of r.factors) {
      expect(f.reason).toBeTruthy()
      // No internal vocabulary leaking at a user.
      expect(f.reason).not.toMatch(/PoiIndex|osmId|geohash|null/)
    }
  })

  it('can never be raised by a factor', () => {
    // The rule the whole mechanism rests on. envelope.js throws on a
    // multiplier above 1; this asserts nothing in this file tries.
    const worst = attributeConfidence('location', poi({
      status: 'ABSENT_FROM_SOURCE', fetchedAt: daysAgo(5000),
    }), ctx({ conflictCounts: { location: 20 }, locationWithheld: true, statusEventCount: 40 }))
    expect(worst.value).toBeLessThanOrEqual(POI_SOURCES.osm.reliability)
    expect(worst.value).toBeGreaterThanOrEqual(0)
  })

  it('rejects an attribute nobody declared', () => {
    expect(() => attributeConfidence('vibes', poi(), ctx())).toThrow(/unknown attribute/)
  })
})

// ── The overall score ───────────────────────────────────────────────────────

describe('poiTrustScore', () => {
  it('scores a well-mapped, fresh POI high', () => {
    const r = poiTrustScore(poi(), ctx())
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.band).toBe('HIGH')
  })

  it('does NOT punish a hospital for having no phone number', () => {
    // The design decision this file exists to protect. OSM's contact coverage
    // in India is thin, so averaging enrichment in would make the score mostly
    // a measurement of how often mappers fill in a phone tag — and would rank
    // a well-known hospital below a random shop that has one.
    const wellKnown = poi({ category: 'hospital', name: 'Manipal Hospital', phone: null, website: null, openingHours: null, address: null, postcode: null })
    const randomShop = poi({ category: 'retail', name: 'SS Traders' })
    expect(poiTrustScore(wellKnown, ctx()).score)
      .toBeGreaterThanOrEqual(poiTrustScore(randomShop, ctx()).score)
  })

  it('reports completeness separately from trust', () => {
    // Two different claims, both worth having: "we know six things about this
    // place" and "we trust the three that matter".
    const bare = poiTrustScore(poi({ phone: null, website: null, openingHours: null, address: null, postcode: null }), ctx())
    expect(bare.completeness).toBeLessThan(poiTrustScore(poi(), ctx()).completeness)
    expect(bare.score).toBeGreaterThan(70)
  })

  it('is driven by the core attributes only', () => {
    expect(CORE_ATTRIBUTES).toEqual(['location', 'identity', 'category'])
    expect(Object.values(ATTRIBUTES).filter((a) => a.group === 'core')
      .reduce((s, a) => s + a.weight, 0)).toBeCloseTo(1, 5)
  })

  it('drops sharply when an independent source disagrees', () => {
    const contradicted = poiTrustScore(poi({ verificationStatus: 'CONTRADICTED', verificationMethod: 'india_post_pincode' }), ctx())
    expect(contradicted.score).toBeLessThanOrEqual(50)
    expect(contradicted.reasons.some((r) => r.sign === '-' && /somewhere else/.test(r.text))).toBe(true)
  })

  it('credits corroboration WITHOUT manufacturing certainty', () => {
    // Verification appears as a reason, but never as a multiplier above 1 —
    // it raises a score only in the sense that failing it lowers one. A single
    // postcode match must not conjure confidence the data does not support.
    const checked = poiTrustScore(poi({ verificationStatus: 'CROSS_CHECKED', verificationMethod: 'india_post_pincode' }), ctx())
    const plain = poiTrustScore(poi(), ctx())
    expect(checked.score).toBe(plain.score)
    expect(checked.reasons.some((r) => r.sign === '+' && /India Post/.test(r.text))).toBe(true)
  })

  it('never claims a penalty it did not apply', () => {
    // Reasons are drawn from the factor chain rather than restated, so this
    // cannot drift.
    const clean = poiTrustScore(poi(), ctx())
    expect(clean.reasons.filter((r) => r.sign === '-')).toEqual([])
  })

  it('explains a MISSING core attribute — the commonest reason a score is low', () => {
    // Found by running the scorer over real OSM rows: an unnamed marketplace
    // scored 55 purely because identity was absent, with an EMPTY reasons
    // array. An absence produces no factor (it is not a penalty), so nothing
    // in the chain mentioned the single thing driving the number.
    const unnamed = poiTrustScore(poi({ name: null, brand: null }), ctx())
    expect(unnamed.score).toBeLessThan(70)
    expect(unnamed.reasons.some((r) => r.sign === '-' && /what it is called/.test(r.text))).toBe(true)
  })

  it('stays quiet about a missing ENRICHMENT attribute', () => {
    // It never affected the score, so saying "we don't have its phone number"
    // about a metro station is noise dressed as an explanation.
    const noPhone = poiTrustScore(poi({ phone: null, website: null }), ctx())
    expect(noPhone.reasons.some((r) => /how to reach it/.test(r.text))).toBe(false)
  })

  it('never ships a low score with no explanation at all', () => {
    // The contract the reasons array exists for: a bare number invites the
    // reader to treat it as a measurement of the PLACE rather than of our
    // knowledge of it.
    for (const p of [
      poi({ name: null, brand: null }),
      poi({ category: null }),
      poi({ fetchedAt: daysAgo(900) }),
      poi({ status: 'ABSENT_FROM_SOURCE' }),
    ]) {
      const r = poiTrustScore(p, ctx())
      if (r.score < 75) expect(r.reasons.filter((x) => x.sign === '-').length).toBeGreaterThan(0)
    }
  })

  it('explains a low score', () => {
    const bad = poiTrustScore(
      poi({ status: 'ABSENT_FROM_SOURCE', fetchedAt: daysAgo(900) }),
      ctx({ conflictCounts: { location: 4, name: 3 }, locationWithheld: true })
    )
    expect(bad.score).toBeLessThan(40)
    expect(bad.reasons.filter((r) => r.sign === '-').length).toBeGreaterThan(1)
  })

  it('stays inside 0-100 at both extremes', () => {
    const best = poiTrustScore(poi({ verificationStatus: 'CROSS_CHECKED' }), ctx())
    const worst = poiTrustScore(
      poi({ status: 'ABSENT_FROM_SOURCE', name: null, brand: null, category: null, fetchedAt: daysAgo(9000), verificationStatus: 'CONTRADICTED' }),
      ctx({ conflictCounts: { location: 50 }, locationWithheld: true, statusEventCount: 99 })
    )
    for (const s of [best.score, worst.score]) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})

// ── Verification ────────────────────────────────────────────────────────────

describe('verifyByPincode', () => {
  const KA = [{ pincode: '560095', state: 'KARNATAKA' }]

  it('confirms when India Post agrees', () => {
    expect(verifyByPincode('560095', KA, 'KARNATAKA'))
      .toEqual({ status: 'CROSS_CHECKED', method: 'india_post_pincode' })
  })

  it('contradicts when it does not', () => {
    expect(verifyByPincode('560095', [{ pincode: '560095', state: 'TAMIL NADU' }], 'KARNATAKA').status)
      .toBe('CONTRADICTED')
  })

  it('says UNVERIFIED when there is nothing to check against', () => {
    // Not-checked is not a finding. A POI with no postcode is not suspicious;
    // it is one whose mapper skipped an optional tag. An unseeded directory
    // must likewise never make every POI look contradicted.
    expect(verifyByPincode(null, KA, 'KARNATAKA').status).toBe('UNVERIFIED')
    expect(verifyByPincode('560095', [], 'KARNATAKA').status).toBe('UNVERIFIED')
    expect(verifyByPincode('560095', KA, null).status).toBe('UNVERIFIED')
    expect(verifyByPincode('560095', KA, []).status).toBe('UNVERIFIED')
  })

  it('accepts any state the metro spans', () => {
    // The bug this replaced: `city` is a METRO-AREA label, not an
    // administrative one, and a single expected state made NCR unverifiable.
    const haryana = [{ pincode: '122001', state: 'HARYANA' }]
    expect(verifyByPincode('122001', haryana, statesOfMetro('Delhi')).status).toBe('CROSS_CHECKED')
  })

  it('compares STATE, never district — a pincode is a route set, not a polygon', () => {
    // India publishes no pincode boundaries, so a pincode legitimately spans
    // districts. Asserting a district match would manufacture contradictions
    // out of correct data.
    const spanning = [
      { pincode: '560095', state: 'KARNATAKA' },
      { pincode: '560095', state: 'KARNATAKA' },
    ]
    expect(verifyByPincode('560095', spanning, 'KARNATAKA').status).toBe('CROSS_CHECKED')
  })

  it('is insensitive to spelling noise', () => {
    expect(verifyByPincode('560095', [{ state: '  karnataka ' }], 'KARNATAKA').status).toBe('CROSS_CHECKED')
  })
})

// ── The metro-extent regression ─────────────────────────────────────────────
// Every case below is a REAL row count from the first production scoring run,
// which flagged ~15,000 correctly-mapped places as CONTRADICTED. The two halves
// matter equally: the structural spill must pass, and the typos must still fail.
// A fix that only did the first would leave verification unable to fail at all.

describe('metro areas that cross a state line', () => {
  const at = (state) => [{ state }]
  const check = (city, state) => verifyByPincode('000000', at(state), statesOfMetro(city)).status

  it('accepts the NCR — 15,216 real POIs that were being called wrong', () => {
    expect(check('Delhi', 'DELHI')).toBe('CROSS_CHECKED')          // 18,802 rows
    expect(check('Delhi', 'HARYANA')).toBe('CROSS_CHECKED')        // 11,233 — Gurgaon
    expect(check('Delhi', 'UTTAR PRADESH')).toBe('CROSS_CHECKED')  //  3,817 — Noida
    expect(check('Delhi', 'RAJASTHAN')).toBe('CROSS_CHECKED')      //    166 — Bhiwadi
  })

  it('accepts Bengaluru reaching Hosur', () => {
    expect(check('Bengaluru', 'KARNATAKA')).toBe('CROSS_CHECKED')
    expect(check('Bengaluru', 'TAMIL NADU')).toBe('CROSS_CHECKED') // 405 rows
  })

  it('STILL catches the typos — the half a lazy fix would have destroyed', () => {
    // None of these states is adjacent to the city. Whitelisting whatever the
    // data contained would have laundered every one of them into "verified".
    expect(check('Mumbai', 'WEST BENGAL')).toBe('CONTRADICTED')   //  1 row
    expect(check('Bengaluru', 'BIHAR')).toBe('CONTRADICTED')      //  4 rows
    expect(check('Hyderabad', 'ODISHA')).toBe('CONTRADICTED')     // 15 rows
    expect(check('Pune', 'UTTAR PRADESH')).toBe('CONTRADICTED')   // 31 rows
  })

  it('leaves a single-state city needing no entry', () => {
    expect(statesOfMetro('Chennai')).toEqual(['TAMIL NADU'])
    expect(check('Chennai', 'TAMIL NADU')).toBe('CROSS_CHECKED')
    expect(check('Chennai', 'KERALA')).toBe('CONTRADICTED')
  })

  it('returns nothing for an unknown city, so it reads as "cannot check"', () => {
    // Never "everything is wrong" — an unrecognised city is our gap, not the
    // data's fault.
    expect(statesOfMetro('Jaipur')).toEqual([])
    expect(verifyByPincode('302001', at('RAJASTHAN'), statesOfMetro('Jaipur')).status).toBe('UNVERIFIED')
  })

  it('covers every supported city', () => {
    for (const city of SUPPORTED_CITIES) {
      expect(statesOfMetro(city).length, `${city} has no states`).toBeGreaterThan(0)
    }
  })
})

// ── The batch job ───────────────────────────────────────────────────────────

describe('scorePoiBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    prismaMock.poiConflict.groupBy.mockResolvedValue([])
    prismaMock.poiConflict.findMany.mockResolvedValue([])
    prismaMock.poiStatusEvent.groupBy.mockResolvedValue([])
    prismaMock.pincodeDirectory.findMany.mockResolvedValue([])
  })

  it('does nothing when there is nothing to score', async () => {
    expect(await scorePoiBatch({ now: NOW })).toEqual({
      scored: 0, verified: 0, contradicted: 0, remaining: false,
    })
    expect(prismaMock.poiIndex.update).not.toHaveBeenCalled()
  })

  it('scores never-scored rows FIRST', async () => {
    await scorePoiBatch({ now: NOW })
    // Postgres sorts NULLs last on ASC by default, so getting this wrong scores
    // the never-scored rows last — precisely backwards.
    expect(prismaMock.poiIndex.findMany.mock.calls[0][0].orderBy)
      .toEqual([{ scoredAt: { sort: 'asc', nulls: 'first' } }])
  })

  it('writes the score, the reasons and the per-attribute detail', async () => {
    prismaMock.poiIndex.findMany.mockResolvedValue([poi()])
    prismaMock.pincodeDirectory.findMany.mockResolvedValue([{ pincode: '560095', state: 'KARNATAKA' }])

    const r = await scorePoiBatch({ now: NOW })

    expect(r.scored).toBe(1)
    expect(r.verified).toBe(1)
    const written = prismaMock.poiIndex.update.mock.calls[0][0].data
    expect(written.trustScore).toBeGreaterThan(0)
    expect(written.trustReasons.reasons.length).toBeGreaterThan(0)
    expect(Object.keys(written.confidence).sort()).toEqual(Object.keys(ATTRIBUTES).sort())
    expect(written.verificationStatus).toBe('CROSS_CHECKED')
    expect(written.verifiedAt).toEqual(NOW)
  })

  it('does not stamp verifiedAt when nothing did any verifying', async () => {
    // Recording the moment we declined to check something would read as a
    // verification.
    prismaMock.poiIndex.findMany.mockResolvedValue([poi({ postcode: null })])
    await scorePoiBatch({ now: NOW })
    const written = prismaMock.poiIndex.update.mock.calls[0][0].data
    expect(written.verificationStatus).toBe('UNVERIFIED')
    expect(written.verifiedAt).toBeUndefined()
  })

  it('never throws into its scheduler', async () => {
    prismaMock.poiIndex.findMany.mockRejectedValue(new Error('connection lost'))
    await expect(scorePoiBatch({ now: NOW })).resolves.toEqual({
      scored: 0, verified: 0, contradicted: 0, remaining: false,
    })
  })

  it('writes nothing on a dry run', async () => {
    prismaMock.poiIndex.findMany.mockResolvedValue([poi()])
    const r = await scorePoiBatch({ now: NOW, dryRun: true })
    expect(r.scored).toBe(1)
    expect(prismaMock.poiIndex.update).not.toHaveBeenCalled()
  })

  it('is off unless POI_INTELLIGENCE_ENABLED is set', async () => {
    prismaMock.poiIndex.findMany.mockResolvedValue([poi()])
    expect(await runPoiScoringTick(NOW)).toEqual({ skipped: true })
    expect(prismaMock.poiIndex.findMany).not.toHaveBeenCalled()
  })
})
