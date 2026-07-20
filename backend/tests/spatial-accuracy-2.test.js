// Second accuracy pass: re-seed invalidation, opening hours, category tiers,
// and the legacy endpoint's owned-data adapter.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { removeStalePois, invalidateCityCells } from '../src/features/spatial/seedMaintenance.js'
import { isOpenAt, openState } from '../src/features/spatial/openingHours.js'
import { pickNearest } from '../src/features/spatial/poiProvider.js'
import {
  canServeLocally, computeAreaIntelligenceLocal,
} from '../src/features/places/areaIntelligenceAdapter.js'

const LAT = 12.9784
const LNG = 77.6408

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.poiIndex.count.mockResolvedValue(5000)
  prismaMock.poiIndex.findMany.mockResolvedValue([])
  prismaMock.poiIndex.aggregate.mockResolvedValue({ _max: { fetchedAt: null } })
  prismaMock.poiIndex.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.spatialContext.findMany.mockResolvedValue([])
  prismaMock.spatialContext.update.mockResolvedValue({})
})

// ── Re-seed invalidation ────────────────────────────────────────────────────
// The audit's fifth prescribed test. The behaviour shipped in the first pass
// but lived inline in a script, so nothing could exercise it.

describe('re-seed maintenance', () => {
  it('deletes only rows the run did not touch', async () => {
    const runStart = new Date('2026-07-19T00:00:00Z')
    prismaMock.poiIndex.deleteMany.mockResolvedValue({ count: 12 })

    const removed = await removeStalePois('Bengaluru', runStart)

    expect(removed).toBe(12)
    expect(prismaMock.poiIndex.deleteMany).toHaveBeenCalledWith({
      where: { city: 'Bengaluru', fetchedAt: { lt: runStart } },
    })
  })

  it('marks the city\'s cells stale so corrected data does not wait out a 60-day TTL', async () => {
    const when = new Date('2026-07-19T00:00:00Z')
    prismaMock.spatialContext.findMany.mockResolvedValue([
      { id: 'c1', modules: {} }, { id: 'c2', modules: {} },
    ])

    const count = await invalidateCityCells('Bengaluru', when)

    expect(count).toBe(2)
    expect(prismaMock.spatialContext.findMany).toHaveBeenCalledWith({
      where: { city: 'Bengaluru' },
      select: { id: true, modules: true },
    })
    expect(prismaMock.spatialContext.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ staleAfter: when }) }),
    )
  })

  // The bug this file's fifth test was written to prevent, and missed: staleness
  // lives at two levels. Expiring only the ROW schedules a recompute that then
  // reuses every envelope, because computeModules tests each module against its
  // own staleAfter. A re-seed changed nothing for up to 90 days.
  it('expires the module envelopes too, not just the row', async () => {
    const when = new Date('2026-07-19T00:00:00Z')
    prismaMock.spatialContext.findMany.mockResolvedValue([{
      id: 'c1',
      modules: {
        // 60-day TTL: the module that hid the bug, since boundaries are what a
        // re-seed most often corrects.
        locality: { key: 'locality', staleAfter: '2026-09-01T00:00:00Z', facts: [] },
        'mobility@ANY': { key: 'mobility', staleAfter: '2026-08-15T00:00:00Z', facts: [] },
      },
    }])

    await invalidateCityCells('Bengaluru', when)

    const written = prismaMock.spatialContext.update.mock.calls[0][0].data.modules
    expect(written.locality.staleAfter).toBe(when.toISOString())
    expect(written['mobility@ANY'].staleAfter).toBe(when.toISOString())
    // Expired, not deleted — a stale cell still renders while the refresher
    // catches up, same as everywhere else in this layer.
    expect(written.locality.key).toBe('locality')
  })

  it('scopes invalidation to one city — re-seeding Pune must not recompute Delhi', async () => {
    prismaMock.spatialContext.findMany.mockResolvedValue([])
    await invalidateCityCells('Pune')
    expect(prismaMock.spatialContext.findMany.mock.calls[0][0].where).toEqual({ city: 'Pune' })
  })

  it('never throws into the seed script when the database is unhappy', async () => {
    prismaMock.poiIndex.deleteMany.mockRejectedValue(new Error('connection lost'))
    prismaMock.spatialContext.findMany.mockRejectedValue(new Error('connection lost'))

    await expect(removeStalePois('Bengaluru', new Date())).resolves.toBe(0)
    await expect(invalidateCityCells('Bengaluru')).resolves.toBe(0)
  })
})

// ── Opening hours ───────────────────────────────────────────────────────────
// The contract that matters: unknown must never be reported as closed.

describe('openingHours', () => {
  const tueNoon = new Date('2026-07-21T12:00:00')   // a Tuesday
  const tue2300 = new Date('2026-07-21T23:00:00')
  const sunNoon = new Date('2026-07-19T12:00:00')   // a Sunday

  it('reads 24/7', () => {
    expect(isOpenAt('24/7', tue2300)).toBe(true)
  })

  it('reads a simple weekday range', () => {
    expect(isOpenAt('Mo-Fr 09:00-18:00', tueNoon)).toBe(true)
    expect(isOpenAt('Mo-Fr 09:00-18:00', tue2300)).toBe(false)
    expect(isOpenAt('Mo-Fr 09:00-18:00', sunNoon)).toBe(false)
  })

  it('reads multiple rules and day lists', () => {
    expect(isOpenAt('Mo-Fr 09:00-18:00; Sa 10:00-14:00', sunNoon)).toBe(false)
    expect(isOpenAt('Mo,We,Fr 09:00-18:00', tueNoon)).toBe(false)
    expect(isOpenAt('Sa-Su 10:00-20:00', sunNoon)).toBe(true)
  })

  it('handles a range that wraps past midnight', () => {
    expect(isOpenAt('Mo-Su 22:00-02:00', tue2300)).toBe(true)
    expect(isOpenAt('Mo-Su 22:00-02:00', tueNoon)).toBe(false)
  })

  it('returns unknown — never closed — for anything it cannot confidently read', () => {
    // Each of these is a real OSM form outside the supported subset. Guessing
    // at them would put a wrong "Closed" on a place that is open.
    for (const spec of [
      'Mo-Fr 09:00-12:00,13:00-18:00',   // split shift
      'Mo-Fr 09:00-18:00; PH off',        // public holidays
      'Mo-Fr 09:00-18:00; Su off',        // an "off" rule
      'sunrise-sunset',
      'Jan-Mar 09:00-17:00',
      '"by appointment"',
      'Mo-Fr',
      '',
      null,
      undefined,
      42,
    ]) {
      expect({ spec, open: isOpenAt(spec, tueNoon) }).toEqual({ spec, open: null })
    }
  })

  it('exposes a three-state string for the API', () => {
    expect(openState('24/7', tueNoon)).toBe('open')
    expect(openState('Mo-Fr 09:00-18:00', tue2300)).toBe('closed')
    expect(openState('PH off', tueNoon)).toBeNull()
    expect(openState(null)).toBeNull()
  })
})

// ── Category quality tiers ──────────────────────────────────────────────────

describe('pickNearest category tiers', () => {
  const at = (m, extra) => ({
    name: 'X', distanceM: m, lat: LAT + m / 111_320, lng: LNG, ...extra,
  })

  it('prefers a hospital over a doctors\' office at comparable distance', () => {
    const hits = [
      at(430, { name: 'Dr Kumar Clinic', category: 'clinic' }),
      at(450, { name: 'Apollo Hospital', category: 'hospital' }),
    ]
    const pick = pickNearest(hits, { prefer: ['hospital', 'clinic'] })
    expect(pick.name).toBe('Apollo Hospital')
  })

  it('does NOT reach past the band — a clinic next door beats a distant hospital', () => {
    const hits = [
      at(80, { name: 'Dr Kumar Clinic', category: 'clinic' }),
      at(2000, { name: 'Apollo Hospital', category: 'hospital' }),
    ]
    const pick = pickNearest(hits, { prefer: ['hospital', 'clinic'] })
    expect(pick.name).toBe('Dr Kumar Clinic')
  })

  it('still prefers a named place when no tiers are given', () => {
    const hits = [at(200, { name: null, category: 'bank' }), at(300, { name: 'HDFC', category: 'bank' })]
    expect(pickNearest(hits).name).toBe('HDFC')
  })

  it('ranks tier above namedness — an unnamed hospital still beats a named clinic', () => {
    const hits = [
      at(400, { name: 'Dr Kumar Clinic', category: 'clinic' }),
      at(420, { name: null, category: 'hospital' }),
    ]
    const pick = pickNearest(hits, { prefer: ['hospital', 'clinic'] })
    expect(pick.category).toBe('hospital')
  })

  it('leaves a single hit alone', () => {
    const only = at(100, { category: 'bank' })
    expect(pickNearest([only], { prefer: ['bank'] })).toBe(only)
  })
})

// ── Legacy endpoint adapter ─────────────────────────────────────────────────
// Released app builds still call /places/area-intelligence. The shape must
// match exactly; the data underneath is now owned rather than billed.

describe('legacy area-intelligence adapter', () => {
  const seeded = () => {
    prismaMock.poiIndex.count.mockResolvedValue(5000)
    prismaMock.poiIndex.findMany.mockResolvedValue([
      { id: '1', category: 'pharmacy', name: 'Chemist', brand: null, lat: LAT + 0.001, lng: LNG },
      { id: '2', category: 'hospital', name: 'Apollo', brand: null, lat: LAT + 0.002, lng: LNG },
      { id: '3', category: 'clinic', name: 'Dr Kumar', brand: null, lat: LAT + 0.0018, lng: LNG },
      { id: '4', category: 'school', name: 'DAV', brand: null, lat: LAT + 0.003, lng: LNG },
      { id: '5', category: 'atm', name: 'HDFC ATM', brand: null, lat: LAT + 0.0005, lng: LNG },
      { id: '6', category: 'bus_stop', name: 'Stop', brand: null, lat: LAT + 0.0006, lng: LNG },
    ])
  }

  it('reports it can serve a seeded city locally, and cannot for an unseeded one', async () => {
    seeded()
    expect(await canServeLocally(LAT, LNG)).toBe(true)

    prismaMock.poiIndex.count.mockResolvedValue(0)
    expect(await canServeLocally(LAT, LNG)).toBe(false)
  })

  it('declines coordinates outside every supported city', async () => {
    expect(await canServeLocally(28.6139, 77.2090 + 40)).toBe(false)
  })

  it('reproduces the legacy response shape exactly', async () => {
    seeded()
    const r = await computeAreaIntelligenceLocal(LAT, LNG)

    expect(Object.keys(r).sort()).toEqual(['essentials', 'itCorridor', 'traffic', 'transit'])
    expect(Object.keys(r.transit).sort()).toEqual([
      'busScore', 'metroScore', 'nearestBus', 'nearestMetro', 'nearestRail', 'railScore',
    ])
    expect(Object.keys(r.essentials).sort()).toEqual([
      'atm', 'hospital', 'pharmacy', 'police', 'school', 'supermarket',
    ])
    expect(Object.keys(r.itCorridor).sort()).toEqual(['itScore', 'nearestItPark'])

    // Every essential is { count, nearest }, and nearest is the legacy shape.
    for (const v of Object.values(r.essentials)) {
      expect(Object.keys(v).sort()).toEqual(['count', 'nearest'])
      if (v.nearest) {
        expect(Object.keys(v.nearest).sort()).toEqual(['distanceM', 'lat', 'lng', 'name'])
      }
    }
  })

  it('answers from owned data — a category with no rows is 0, not a Google call', async () => {
    seeded()
    const r = await computeAreaIntelligenceLocal(LAT, LNG)

    expect(r.essentials.pharmacy.count).toBe(1)
    expect(r.essentials.pharmacy.nearest.name).toBe('Chemist')
    // No police in the fixture — an honest zero, and no fallback fired.
    expect(r.essentials.police.count).toBe(0)
    expect(r.essentials.police.nearest).toBeNull()
  })

  it('merges clinics into the legacy hospital key but headlines the hospital', async () => {
    seeded()
    const r = await computeAreaIntelligenceLocal(LAT, LNG)
    // Legacy Google `type=hospital` returned both, so the count spans both...
    expect(r.essentials.hospital.count).toBe(2)
    // ...while the tier preference still names the actual hospital.
    expect(r.essentials.hospital.nearest.name).toBe('Apollo')
  })

  it('finds a real metro station from the network files at zero cost', async () => {
    seeded()
    const r = await computeAreaIntelligenceLocal(LAT, LNG)
    // Indiranagar is well inside the 2 km legacy radius.
    expect(r.transit.nearestMetro).not.toBeNull()
    expect(r.transit.metroScore).toBeGreaterThan(0)
    expect(r.transit.nearestMetro.distanceM).toBeLessThanOrEqual(2000)
  })

  it('reports traffic as unavailable rather than paying for it', async () => {
    seeded()
    const r = await computeAreaIntelligenceLocal(LAT, LNG)
    // null is the contract's existing "unavailable" case; old clients handle it.
    expect(r.traffic).toBeNull()
  })
})
