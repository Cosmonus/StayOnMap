// POI lifecycle, conflict detection and spatial validation.
//
// The three properties worth pinning, in the order they matter:
//
//   1. Nothing is ever deleted. Deletion is the one data loss no later work
//      repairs, and it is a two-character edit away from returning.
//   2. Nothing user-facing changed. An absent row must be exactly as invisible
//      as a deleted one was, or this became a regression instead of a fix.
//   3. A disagreement is recorded whether or not it is applied — and the ONE
//      case that is withheld is withheld.
//
// Cases are real Indian POI shapes rather than synthetic ones: a chain with
// branches, a campus mapped in pieces, a kirana beside its neighbour, the OSM
// node/way double, a vocabulary re-cut.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { markAbsentPois, reviveReturnedPois } from '../src/features/spatial/seedMaintenance.js'
import { detectConflicts, validateCoordinate } from '../src/features/spatial/poiConflicts.js'
import {
  policyFor, footprintFor, volatilityFor, moveThresholdM, implausibleMoveM, POI_POLICY,
} from '../src/features/spatial/poiPolicy.js'
import { CATEGORY_KEYS } from '../src/features/spatial/poiCategories.js'
import {
  poisNear, listPoisNear, poiCoverage, cityCategoryCoverage, SERVING,
} from '../src/features/spatial/poiProvider.js'

// Koramangala, Bengaluru — a dense mixed-use area, which is where every one of
// these rules actually gets exercised.
const LAT = 12.9352
const LNG = 77.6245

// ~1 m of latitude, so a test can express "40 m away" without a magic decimal.
const M = 1 / 111_320

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(5000)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.poiIndex.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.poiIndex.groupBy.mockResolvedValue([])
  prismaMock.poiIndex.aggregate.mockResolvedValue({ _max: { fetchedAt: null } })
})

// ── The serving contract ────────────────────────────────────────────────────
// Rule 2. Every read must carry the status predicate; a query that forgets it
// does not fail, it silently starts advertising a chemist that closed.

describe('serving queries exclude absent POIs', () => {
  it('SERVING is the ACTIVE predicate', () => {
    expect(SERVING).toEqual({ status: 'ACTIVE' })
  })

  it('poisNear filters on status', async () => {
    await poisNear(LAT, LNG, 800, ['pharmacy'], 'Bengaluru')
    expect(prismaMock.poiIndex.findMany.mock.calls[0][0].where.status).toBe('ACTIVE')
  })

  it('listPoisNear filters on status', async () => {
    await listPoisNear(LAT, LNG, ['pharmacy'], 800, 'Bengaluru')
    expect(prismaMock.poiIndex.findMany.mock.calls[0][0].where.status).toBe('ACTIVE')
  })

  it('coverage counts only ACTIVE rows — an absent row is not coverage', async () => {
    await poiCoverage('Bengaluru')
    expect(prismaMock.poiIndex.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', city: 'Bengaluru' },
    })
  })

  it('per-category coverage filters on status too', async () => {
    // This one gates whether a zero reads as "none nearby" or "never loaded".
    // Counting absent rows here would report a category as covered on the
    // strength of places that are gone.
    await cityCategoryCoverage('Bengaluru')
    expect(prismaMock.poiIndex.groupBy.mock.calls[0][0].where.status).toBe('ACTIVE')
  })
})

// ── Absence and revival ─────────────────────────────────────────────────────

describe('markAbsentPois', () => {
  it('marks, records history, and does not delete', async () => {
    const runStart = new Date('2026-08-11T00:00:00Z')
    prismaMock.poiIndex.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    prismaMock.poiIndex.updateMany.mockResolvedValue({ count: 2 })

    expect(await markAbsentPois('Bengaluru', runStart)).toBe(2)

    expect(prismaMock.poiIndex.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ABSENT_FROM_SOURCE' }) })
    )
    expect(prismaMock.poiStatusEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ poiIndexId: 'p1', fromStatus: 'ACTIVE', toStatus: 'ABSENT_FROM_SOURCE' }),
        expect.objectContaining({ poiIndexId: 'p2', fromStatus: 'ACTIVE', toStatus: 'ABSENT_FROM_SOURCE' }),
      ],
    })
    expect(prismaMock.poiIndex.deleteMany).not.toHaveBeenCalled()
  })

  it('does not re-mark a POI that was already absent', async () => {
    // Quarterly re-seeds would otherwise write one event per run for a place
    // that has simply stayed gone, and the history would be mostly noise.
    prismaMock.poiIndex.findMany.mockResolvedValue([])
    expect(await markAbsentPois('Bengaluru', new Date())).toBe(0)
    expect(prismaMock.poiIndex.findMany.mock.calls[0][0].where.status).toBe('ACTIVE')
    expect(prismaMock.poiStatusEvent.createMany).not.toHaveBeenCalled()
  })

  it('still marks the POI when its history row will not insert', async () => {
    // The status change is the operational fact; the event is the record of it.
    // Losing the record is bad, refusing the change is worse.
    prismaMock.poiIndex.findMany.mockResolvedValue([{ id: 'p1' }])
    prismaMock.poiIndex.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.poiStatusEvent.createMany.mockRejectedValue(new Error('disk full'))

    expect(await markAbsentPois('Bengaluru', new Date())).toBe(1)
  })
})

describe('reviveReturnedPois', () => {
  it('brings back a POI the fetch returned, with its own event', async () => {
    // Routine in OSM: one mapper retags a node, another reverts it. Without
    // this the row sits absent forever while the source plainly says otherwise.
    const since = new Date('2026-08-11T00:00:00Z')
    prismaMock.poiIndex.findMany.mockResolvedValue([{ id: 'p9' }])
    prismaMock.poiIndex.updateMany.mockResolvedValue({ count: 1 })

    expect(await reviveReturnedPois('Bengaluru', since)).toBe(1)

    expect(prismaMock.poiIndex.findMany).toHaveBeenCalledWith({
      where: { city: 'Bengaluru', status: 'ABSENT_FROM_SOURCE', fetchedAt: { gte: since } },
      select: { id: true },
    })
    expect(prismaMock.poiStatusEvent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ fromStatus: 'ABSENT_FROM_SOURCE', toStatus: 'ACTIVE' })],
    })
  })
})

// ── Spatial validation ──────────────────────────────────────────────────────

describe('validateCoordinate', () => {
  it('accepts a real Indian coordinate', () => {
    expect(validateCoordinate(LAT, LNG).valid).toBe(true)
  })

  it('rejects (0, 0) with its own reason, not "outside India"', () => {
    // Null island passes every range check because it IS a valid point. The
    // distinct reason is the useful part: it says the bug is upstream.
    const r = validateCoordinate(0, 0)
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/unset field/)
  })

  it('rejects a non-finite coordinate', () => {
    expect(validateCoordinate(NaN, LNG).valid).toBe(false)
    expect(validateCoordinate(LAT, undefined).valid).toBe(false)
  })

  it('rejects a coordinate outside the box', () => {
    // Dubai — real, correctly mapped, and nowhere near this product.
    expect(validateCoordinate(25.2048, 55.2708).reason).toMatch(/outside India/)
  })

  it('is a BOX, not a border — Colombo passes, and that is correct here', () => {
    // 6.93N 79.86E is inside INDIA_BOUNDS. This check is the coarse gate that
    // catches parse failures and hemisphere errors; `resolveCity` is the fine
    // one that decides a POI belongs to a supported city, and the ingestion
    // script runs both. Asserting the box rejects Sri Lanka would be asserting
    // a precision it does not have, and the next person would "fix" the box
    // into a polygon nobody needs.
    expect(validateCoordinate(6.9271, 79.8612).valid).toBe(true)
  })

  it('accepts the far corners of the country', () => {
    expect(validateCoordinate(34.15, 77.57).valid).toBe(true)  // Leh
    expect(validateCoordinate(8.09, 77.55).valid).toBe(true)   // Kanyakumari
    expect(validateCoordinate(28.61, 95.32).valid).toBe(true)  // Arunachal
  })
})

// ── The policy table ────────────────────────────────────────────────────────

describe('poiPolicy', () => {
  it('covers every category in the vocabulary', () => {
    // A category added to poiCategories.js and forgotten here silently falls
    // back to the tightest default, and nothing would say so.
    const missing = CATEGORY_KEYS.filter((k) => !POI_POLICY[k])
    expect(missing).toEqual([])
  })

  it('gives a hospital campus more room than a paan shop', () => {
    expect(footprintFor('hospital').namedM).toBeGreaterThan(footprintFor('cafe').namedM)
    expect(footprintFor('airport').namedM).toBeGreaterThan(footprintFor('hospital').namedM)
  })

  it('separates footprint from volatility — they are different axes', () => {
    // A mall is huge and stable; its tenants churn but the building does not.
    // A cafe is tiny and volatile. If one class drove both, these would agree.
    expect(policyFor('mall')).toEqual({ footprint: 'LARGE', volatility: 'STABLE' })
    expect(policyFor('cafe')).toEqual({ footprint: 'POINT', volatility: 'VOLATILE' })
    expect(volatilityFor('metro_station').refreshDays)
      .toBeGreaterThan(volatilityFor('restaurant').refreshDays)
  })

  it('falls back to the tightest, shortest policy for an unknown category', () => {
    // Both directions are the conservative one: fewest merges, least claimed.
    expect(policyFor('sky_bar_2027')).toEqual({ footprint: 'POINT', volatility: 'VOLATILE' })
  })

  it('derives the move threshold from the footprint rather than a third number', () => {
    expect(moveThresholdM('hospital')).toBe(footprintFor('hospital').namedM)
  })

  it('never lets the implausible bar fall below 2 km', () => {
    expect(implausibleMoveM('cafe')).toBe(2000)
    // …but an airport, whose footprint is already 1 km, gets proportionally more.
    expect(implausibleMoveM('airport')).toBe(5000)
  })
})

// ── Conflict detection ──────────────────────────────────────────────────────

const stored = (over = {}) => ({
  id: 'poi1', osmId: 'node/1', category: 'pharmacy',
  name: 'Apollo Pharmacy', lat: LAT, lng: LNG, ...over,
})
const incoming = (over = {}) => ({
  osmId: 'node/1', category: 'pharmacy',
  name: 'Apollo Pharmacy', lat: LAT, lng: LNG, ...over,
})

describe('detectConflicts', () => {
  it('reports nothing for a new POI', () => {
    const r = detectConflicts(null, incoming())
    expect(r.conflicts).toEqual([])
    expect(r.resolved).toEqual(incoming())
  })

  it('ignores a nudge inside the footprint', () => {
    // Mappers move a node from the building centroid to the door constantly.
    // Recording that would bury the real moves under thousands of rows.
    const r = detectConflicts(stored(), incoming({ lat: LAT + 40 * M }))
    expect(r.conflicts).toEqual([])
  })

  it('records a move beyond the footprint, and applies it', () => {
    const r = detectConflicts(stored(), incoming({ lat: LAT + 250 * M }))
    const c = r.conflicts.find((x) => x.attribute === 'location')
    expect(c.applied).toBe(true)
    expect(c.distanceM).toBeGreaterThan(200)
    // Applied means the new coordinate is what gets written.
    expect(r.resolved.lat).toBeCloseTo(LAT + 250 * M, 6)
  })

  it('WITHHOLDS an implausible jump and keeps our coordinate', () => {
    // The single withhold case. A pharmacy does not move four kilometres, so
    // "this record is now wrong" beats "the place moved" — and applying it
    // would put it in another suburb on every card that cites it.
    const r = detectConflicts(stored(), incoming({ lat: LAT + 4000 * M }))
    const c = r.conflicts.find((x) => x.attribute === 'location')
    expect(c.applied).toBe(false)
    expect(r.withheld).toEqual(['location'])
    expect(Number(r.resolved.lat)).toBe(LAT)
  })

  it('judges the move against the STORED category, not the incoming one', () => {
    // Otherwise a mis-classification widens its own threshold: a shop
    // mis-tagged as an airport would inherit a 1 km footprint and its
    // relocation would stop being a finding at all.
    const asShop = detectConflicts(stored({ category: 'cafe' }), incoming({ category: 'airport', lat: LAT + 300 * M }))
    expect(asShop.conflicts.some((c) => c.attribute === 'location')).toBe(true)
  })

  it('records a rename', () => {
    const r = detectConflicts(stored(), incoming({ name: 'MedPlus' }))
    expect(r.conflicts).toContainEqual(expect.objectContaining({
      attribute: 'name', currentValue: 'Apollo Pharmacy', incomingValue: 'MedPlus', applied: true,
    }))
  })

  it('ignores punctuation and casing churn in a name', () => {
    // "TCS Ltd." → "TCS Ltd" is not a rename, and OSM produces this constantly.
    const r = detectConflicts(stored({ name: 'TCS Ltd.' }), incoming({ name: 'tcs  ltd' }))
    expect(r.conflicts).toEqual([])
  })

  it('treats a name ARRIVING as an improvement, not a disagreement', () => {
    const r = detectConflicts(stored({ name: null }), incoming({ name: 'Arathi Medicals' }))
    expect(r.conflicts).toEqual([])
  })

  it('treats a name DISAPPEARING as a finding', () => {
    const r = detectConflicts(stored(), incoming({ name: null }))
    expect(r.conflicts).toContainEqual(expect.objectContaining({ attribute: 'name', incomingValue: null }))
  })

  it('records a category change and still applies it', () => {
    // The vocabulary has been re-cut twice (school/college, restaurant/
    // fast_food) and both times the re-seed's whole purpose was to reclassify
    // stored rows. Withholding would have made those fixes impossible.
    const r = detectConflicts(stored({ category: 'restaurant' }), incoming({ category: 'food_cheap' }))
    expect(r.conflicts).toContainEqual(expect.objectContaining({
      attribute: 'category', currentValue: 'restaurant', incomingValue: 'food_cheap', applied: true,
    }))
    expect(r.resolved.category).toBe('food_cheap')
  })

  it('reports several attributes at once', () => {
    const r = detectConflicts(
      stored(),
      incoming({ name: 'MedPlus', category: 'clinic', lat: LAT + 300 * M })
    )
    expect(r.conflicts.map((c) => c.attribute).sort()).toEqual(['category', 'location', 'name'])
  })

  it('stamps every conflict with the source that asserted it', () => {
    // One source today, which is exactly why this is recorded: a disagreement
    // BETWEEN sources and one between two observations FROM a source are
    // different findings, and telling them apart later needs the column now.
    const r = detectConflicts(stored(), incoming({ name: 'MedPlus' }), { source: 'overture' })
    expect(r.conflicts[0].source).toBe('overture')
  })

  it('carries a distance only where distance means something', () => {
    const r = detectConflicts(stored(), incoming({ name: 'MedPlus' }))
    // Null, never 0 — 0 would read as "it did not move", which is a claim.
    expect(r.conflicts[0].distanceM).toBeNull()
  })
})

// ── Branches, doubles and neighbours ────────────────────────────────────────
// Not conflicts — these are the cases the thresholds exist to keep APART, and
// they are the ones a naive implementation gets wrong.

describe('the cases that must not become conflicts', () => {
  it('two branches of one chain are different osmIds, never compared', () => {
    // Apollo Koramangala and Apollo Indiranagar are 4 km apart. They never meet
    // in detectConflicts because it compares one osmId against itself — the
    // branch problem belongs to entity resolution (places.js), not here.
    const a = detectConflicts(stored({ osmId: 'node/1' }), incoming({ osmId: 'node/1' }))
    expect(a.conflicts).toEqual([])
  })

  it('a large campus tolerates a move that would be a finding for a shop', () => {
    // A university node moving 300 m is a mapper picking a different gate.
    // The same 300 m for a cafe is a different cafe.
    const campus = detectConflicts(
      stored({ category: 'college' }), incoming({ category: 'college', lat: LAT + 300 * M })
    )
    const shop = detectConflicts(
      stored({ category: 'cafe' }), incoming({ category: 'cafe', lat: LAT + 300 * M })
    )
    expect(campus.conflicts).toEqual([])
    expect(shop.conflicts.some((c) => c.attribute === 'location')).toBe(true)
  })
})
