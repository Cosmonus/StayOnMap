/**
 * Parser stages on synthetic fixtures: lifecycle filtering, route_master
 * variant merging (the duplicate-directional-lines fix), station membership
 * from relation roles, and end-to-end determinism of parseCity.
 */

import { describe, it, expect } from 'vitest'
import { classifyRoute } from '../../src/metro-engine/parse/lifecycle.js'
import { groupByMaster, mergeVariants } from '../../src/metro-engine/parse/variants.js'
import { buildStations } from '../../src/metro-engine/parse/stations.js'
import { parseCity } from '../../src/metro-engine/parse/parse.js'
import { cityCuration } from '../../src/metro-engine/curation.js'

const NO_RULES = cityCuration({ version: 1, cities: {} }, 'Testville')

// ── fixture helpers ─────────────────────────────────────────────────────────

const wayMember = (ref, coords, role = '') =>
  ({ type: 'way', ref, role, geometry: coords.map(([lat, lon]) => ({ lat, lon })) })
const stopMember = (ref) => ({ type: 'node', ref, role: 'stop' })
const node = (id, [lat, lon], name, tags = {}) =>
  ({ type: 'node', id, lat, lon, tags: { name, public_transport: 'stop_position', ...tags } })
const route = (id, name, members, tags = {}) =>
  ({ type: 'relation', id, tags: { type: 'route', route: 'subway', name, ...tags }, members })
const master = (id, name, memberIds, tags = {}) => ({
  type: 'relation',
  id,
  tags: { type: 'route_master', route_master: 'subway', name, ...tags },
  members: memberIds.map((ref) => ({ type: 'relation', ref, role: '' })),
})

// A straight north-south track at lng, from lat 23.0, `n` points 0.001° apart.
const track = (lng, n, fromLat = 23.0) =>
  Array.from({ length: n }, (_, i) => [fromLat + i * 0.001, lng])

// Chained-route shape that mergeVariants consumes.
const chainedRoute = (relation, components, wayIds, stopRefs = []) =>
  ({ relation, components, wayIds: new Set(wayIds), stopRefs, log: { componentCount: components.length, breaks: 0 } })

// ── lifecycle ───────────────────────────────────────────────────────────────

describe('classifyRoute', () => {
  const r = (tags) => ({ id: 1, tags: { type: 'route', name: 'X', ...tags } })

  it('passes an operational route', () => {
    expect(classifyRoute(r({ route: 'subway' }), NO_RULES).status).toBe('active')
  })

  it.each([
    [{ route: 'construction', construction: 'subway' }, 'route=construction'],
    [{ route: 'proposed', proposed: 'subway' }, 'route=proposed'],
    [{ route: 'subway', state: 'proposed' }, 'state=proposed'],
    [{ route: 'subway', construction: 'yes' }, 'construction=yes'],
    [{ route: 'subway', 'proposed:route': 'subway' }, 'lifecycle tag proposed:route'],
  ])('excludes %o with a logged reason', (tags, reason) => {
    const verdict = classifyRoute(r(tags), NO_RULES)
    expect(verdict.status).toBe('excluded')
    expect(verdict.reason).toBe(reason)
  })

  it('applies curation exclusions by relation id and by name pattern, citing the rule', () => {
    const rules = cityCuration({
      version: 1,
      cities: {
        Testville: {
          excludeRelations: [{ ruleId: 'tv-1', id: 1, reason: 'not open yet' }],
          excludeNamePatterns: [{ ruleId: 'tv-2', pattern: 'Phase 2', reason: 'phase 2' }],
        },
      },
    }, 'Testville')
    expect(classifyRoute(r({ route: 'subway' }), rules).reason).toContain('curation tv-1')
    expect(classifyRoute({ id: 9, tags: { type: 'route', route: 'subway', name: 'Line 3 Phase 2' } }, rules).reason)
      .toContain('curation tv-2')
  })
})

// ── variant merging ─────────────────────────────────────────────────────────

describe('groupByMaster + mergeVariants', () => {
  it('merges two directions on separate parallel tracks into one line, unioning stops', () => {
    // Up track at 72.5, down track ~22m east — zero shared ways, which is the
    // normal double-tracked case the way-id Jaccard alone can never merge.
    const up = route(11, 'Blue Line: A → B', [])
    const down = route(12, 'Blue Line: B → A', [])
    const m = master(10, 'Blue Line', [11, 12], { colour: 'blue' })
    const groups = groupByMaster([
      chainedRoute(up, [track(72.5, 10)], [1, 2, 3], [101]),
      chainedRoute(down, [track(72.5002, 10).reverse()], [4, 5, 6], [102]),
    ], [m])

    expect(groups).toHaveLength(1)
    const lines = mergeVariants(groups[0])
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('Blue Line')
    expect(lines[0].osmRouteMasterId).toBe(10)
    expect(lines[0].variantRelationIds).toEqual([11, 12])
    expect(lines[0].stopRefs.sort()).toEqual([101, 102])
  })

  it('keeps a genuinely diverging branch as its own line under the same master', () => {
    const main = route(21, 'Blue Line: A → B', [])
    // Branch shares nothing: a separate corridor ~5.5km east.
    const branch = route(22, 'Blue Line: C → D', [])
    const m = master(20, 'Blue Line', [21, 22])
    const lines = mergeVariants(groupByMaster([
      chainedRoute(main, [track(72.5, 20)], [1, 2]),
      chainedRoute(branch, [track(72.55, 8)], [3, 4]),
    ], [m])[0])

    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.name).sort()).toEqual(['Blue Line: A → B', 'Blue Line: C → D'])
    expect(new Set(lines.map((l) => l.osmRouteMasterId))).toEqual(new Set([20]))
  })

  it('merges single-track directions via shared way ids', () => {
    const up = route(31, 'Tram: A → B', [])
    const down = route(32, 'Tram: B → A', [])
    const m = master(30, 'Tram', [31, 32])
    const lines = mergeVariants(groupByMaster([
      chainedRoute(up, [track(72.5, 10)], [1, 2, 3]),
      chainedRoute(down, [track(72.5, 10).reverse()], [1, 2, 3]),
    ], [m])[0])
    expect(lines).toHaveLength(1)
  })

  it('collapses 4 variants (two directions + short-turn services) into one line', () => {
    const variants = [31, 32, 33, 34].map((id, i) => chainedRoute(
      route(id, `Green ${i}`, []),
      [track(72.5 + (i % 2) * 0.0002, i < 2 ? 12 : 6)], // short-turns cover half
      [`w${id}`],
    ))
    const m = master(30, 'Green Line', [31, 32, 33, 34])
    const lines = mergeVariants(groupByMaster(variants, [m])[0])
    expect(lines).toHaveLength(1)
    expect(lines[0].variantRelationIds).toEqual([31, 32, 33, 34])
  })

  it('routes without a master become their own groups', () => {
    const orphan = route(41, 'Orphan Line', [])
    const groups = groupByMaster([chainedRoute(orphan, [track(72.5, 5)], [1])], [])
    expect(groups).toHaveLength(1)
    expect(groups[0].master).toBeNull()
  })
})

// ── stations ────────────────────────────────────────────────────────────────

describe('buildStations', () => {
  const nodesById = new Map([
    [101, node(101, [23.0, 72.5], 'Alpha')],
    [102, node(102, [23.0002, 72.5002], 'Alpha')], // opposite platform, same station
    [103, node(103, [23.01, 72.5], 'Beta')],
    [104, node(104, [23.1, 72.5], 'Alpha')],       // same name, 11km away — different place
    [105, { type: 'node', id: 105, lat: 23.02, lon: 72.5, tags: { public_transport: 'stop_position' } }], // unnamed
  ])

  it('merges same-named platforms within 400m into one station and marks cross-line interchanges', () => {
    const lines = [
      { stopRefs: [101, 103, 105] },
      { stopRefs: [102, 104] },
    ]
    const { stations, unnamedStopCount } = buildStations(lines, nodesById)

    const alphas = stations.filter((s) => s.name === 'Alpha')
    expect(alphas).toHaveLength(2) // merged pair + the distant namesake
    const interchange = alphas.find((s) => s.lines.length === 2)
    expect(interchange.lines).toEqual([0, 1])
    // Coordinate comes from the lowest-index line's real node, never a centroid.
    expect([interchange.lat, interchange.lng]).toEqual([23.0, 72.5])
    expect(interchange.osmNodeIds).toEqual([101, 102])

    expect(stations.find((s) => s.name === 'Beta').lines).toEqual([0])
    expect(unnamedStopCount).toBe(1)
    // Sorted by name for deterministic output.
    expect(stations.map((s) => s.name)).toEqual([...stations.map((s) => s.name)].sort())
  })
})

// ── end-to-end determinism ──────────────────────────────────────────────────

describe('parseCity', () => {
  const path = track(72.5, 10)
  const elements = [
    master(10, 'Blue Line', [11, 12], { colour: 'blue' }),
    route(11, 'Blue Line: A → B', [
      stopMember(101), stopMember(103),
      wayMember(1, path.slice(0, 5)), wayMember(2, path.slice(4)),
    ], { colour: 'blue' }),
    route(12, 'Blue Line: B → A', [
      stopMember(102),
      wayMember(3, [...track(72.5002, 10)].reverse()),
    ], { colour: 'blue' }),
    route(13, 'Phase 2 (u/c)', [wayMember(4, track(72.6, 4))], { route: 'construction', construction: 'subway' }),
    node(101, [23.0, 72.5], 'Alpha'),
    node(102, [23.0002, 72.5002], 'Alpha'),
    node(103, [23.009, 72.5], 'Beta'),
  ]
  const envelope = {
    city: 'Testville',
    fetchedAt: '2026-07-19T00:00:00Z',
    endpoint: 'https://overpass.example/api',
    osmDataTimestamp: '2026-07-19T00:00:00Z',
    elements,
  }

  it('produces one merged line, records the exclusion with its reason, and stays in shipped schema', () => {
    const { candidate, parseLog } = parseCity(envelope, { version: 1, cities: {} })

    expect(candidate.city).toBe('Testville')
    expect(candidate.lines).toHaveLength(1)
    expect(candidate.lines[0].name).toBe('Blue Line')
    expect(candidate.lines[0].variantRelationIds).toEqual([11, 12])
    expect(candidate.lines[0].path.length).toBeGreaterThanOrEqual(10)
    expect(candidate.stations.map((s) => s.name)).toEqual(['Alpha', 'Beta'])
    expect(candidate.stations.every((s) => s.lines.includes(0))).toBe(true)
    expect(candidate.meta.excludedRelations).toEqual([
      { id: 13, name: 'Phase 2 (u/c)', reason: 'route=construction' },
    ])
    expect(candidate.meta.source).toBe('overpass')
    expect(parseLog.lines[0].stationMethod).toBe('relation-roles')
  })

  it('is deterministic — two parses of the same raw are identical apart from parsedAt', () => {
    const strip = ({ candidate }) => ({ ...candidate, meta: { ...candidate.meta, parsedAt: null } })
    expect(strip(parseCity(envelope, { version: 1, cities: {} })))
      .toEqual(strip(parseCity(envelope, { version: 1, cities: {} })))
  })
})
