/**
 * Repair functions: each pure, each reporting its changes, and the composed
 * repairNetwork idempotent — repairing a repaired network changes nothing.
 */

import { describe, it, expect } from 'vitest'
import {
  dedupeConsecutivePoints,
  dropTinyFragments,
  orderComponents,
  normalizeColor,
  mergeDuplicateLines,
  reindexStationLines,
  normalizeLineNames,
  applyCurationRenames,
} from '../../src/metro-engine/repair/repairs.js'
import { repairNetwork } from '../../src/metro-engine/repair/repair.js'

const track = (lng, n, fromLat = 23.0) =>
  Array.from({ length: n }, (_, i) => [fromLat + i * 0.001, lng])

describe('dedupeConsecutivePoints', () => {
  it('removes points closer than the epsilon, keeping the first of each run', () => {
    const dupe = [23.0000001, 72.5]
    const { path, removedCount } = dedupeConsecutivePoints([[23.0, 72.5], dupe, [23.001, 72.5]])
    expect(path).toEqual([[23.0, 72.5], [23.001, 72.5]])
    expect(removedCount).toBe(1)
  })
})

describe('dropTinyFragments', () => {
  it('drops a stray stub component, never interior points', () => {
    const main = track(72.5, 10)
    const stub = [[23.5, 72.9], [23.50002, 72.9]] // ~2m long, far away
    const { path, dropped } = dropTinyFragments([...main, ...stub])
    expect(path).toEqual(main)
    expect(dropped).toHaveLength(1)
  })

  it('keeps genuine multi-component lines intact', () => {
    const a = track(72.5, 5)
    const b = track(72.6, 5) // ~10km east — a real gap, both segments real
    expect(dropTinyFragments([...a, ...b])).toEqual({ path: [...a, ...b], dropped: [] })
  })
})

describe('orderComponents', () => {
  it('reorders gap-separated components into travel order, flipping as needed', () => {
    const first = track(72.5, 5)               // lat 23.000–23.004
    const second = track(72.5, 5, 23.05)       // lat 23.050–23.054
    const third = track(72.5, 5, 23.1)         // lat 23.100–23.104
    // Stored as: third, first, second-reversed — the old "teleporting parts" shape.
    const scrambled = [...third, ...first, ...[...second].reverse()]
    const { path, reordered } = orderComponents(scrambled)
    expect(reordered).toBe(true)
    // Greedy from the first stored component (third): descends to second, then first.
    expect(path).toEqual([...third, ...[...second].reverse(), ...[...first].reverse()])
  })

  it('is a no-op on an already-ordered path', () => {
    const path = [...track(72.5, 5), ...track(72.5, 5, 23.05)]
    expect(orderComponents(path)).toEqual({ path, reordered: false })
  })
})

describe('normalizeColor', () => {
  it.each([
    ['blue', '#0000ff'],
    ['0f0', '#00ff00'],
    ['#ABCDEF', '#abcdef'],
    ['#ff0000', '#ff0000'],
  ])('canonicalizes %s → %s', (input, expected) => {
    expect(normalizeColor(input).color).toBe(expected)
  })

  it('passes unrecognized values through unchanged rather than guessing', () => {
    expect(normalizeColor('metrogreen')).toEqual({ color: 'metrogreen', changed: false, recognized: false })
  })
})

describe('mergeDuplicateLines', () => {
  const line = (name, path, variantRelationIds = []) => ({ name, color: '#111111', path, variantRelationIds })

  it('merges same-named direction pairs OSM never grouped, remapping station indices', () => {
    const lines = [
      line('RRTS (A → B)', track(72.5, 10), [1]),
      line('RRTS (B → A)', [...track(72.5002, 10)].reverse(), [2]),
      line('Other Line', track(72.9, 10), [3]),
    ]
    const { lines: result, indexMap, merged } = mergeDuplicateLines(lines)
    expect(result.map((l) => l.name)).toEqual(['RRTS (A → B)', 'Other Line'])
    expect(result[0].variantRelationIds).toEqual([1, 2])
    expect(merged).toHaveLength(1)

    const stations = reindexStationLines([{ name: 'S', lat: 23, lng: 72.5, lines: [0, 1] }, { name: 'T', lat: 23, lng: 72.9, lines: [2] }], indexMap)
    expect(stations[0].lines).toEqual([0]) // both directions collapse to the kept line
    expect(stations[1].lines).toEqual([1])
  })

  it('never merges differently-named lines, even at full geometric coverage — a through-service is not a duplicate', () => {
    // Ahmedabad's real shape: Yellow Line through-runs the Red Line corridor.
    const red = line('Red Line', track(72.5, 10))
    const yellow = line('Yellow Line', track(72.5, 25)) // covers red entirely and continues
    const { lines: result, merged } = mergeDuplicateLines([red, yellow])
    expect(result).toHaveLength(2)
    expect(merged).toEqual([])
  })
})

describe('normalizeLineNames', () => {
  it('strips directional decoration when the base name is unique, keeps it on collision', () => {
    const { lines, renamed } = normalizeLineNames([
      { name: 'Blue Line (Kavi Subhash ↔ Dakshineshwar)' },
      { name: 'Line 1 (Versova ↔ Ghatkopar)' },
      { name: 'Line 1 (CBD Belapur ⇔ Pendhar)' },
    ])
    expect(lines.map((l) => l.name)).toEqual([
      'Blue Line',
      'Line 1 (Versova ↔ Ghatkopar)',
      'Line 1 (CBD Belapur ⇔ Pendhar)',
    ])
    expect(renamed).toHaveLength(1)
  })
})

describe('applyCurationRenames', () => {
  it('renames by osm id and reports the applied rule', () => {
    const network = {
      lines: [{ name: 'Line 1', osmRelationId: 5 }],
      stations: [{ name: 'Sta', osmNodeIds: [9] }],
    }
    const rules = {
      renameLines: [{ ruleId: 'r1', osmRelationId: 5, to: 'Meerut Metro Line 1', reason: 'x' }],
      renameStations: [{ ruleId: 'r2', osmNodeId: 9, to: 'Sta (East)', reason: 'y' }],
    }
    const { network: result, applied } = applyCurationRenames(network, rules)
    expect(result.lines[0].name).toBe('Meerut Metro Line 1')
    expect(result.stations[0].name).toBe('Sta (East)')
    expect(applied.map((a) => a.ruleId)).toEqual(['r1', 'r2'])
  })
})

describe('repairNetwork', () => {
  const candidate = {
    city: 'Testville',
    meta: { curationApplied: [] },
    lines: [
      { name: 'Blue Line (A ⇔ B)', color: 'blue', path: [[23.0, 72.5], [23.0000001, 72.5], ...track(72.5, 8, 23.001)], osmRelationId: 1, variantRelationIds: [1] },
    ],
    stations: [{ name: 'Alpha', lat: 23.0, lng: 72.5, lines: [0], osmNodeId: 9, osmNodeIds: [9] }],
  }
  const curation = { version: 1, cities: {} }

  it('is idempotent — the second pass reports zero changes', () => {
    const first = repairNetwork(candidate, curation)
    expect(first.log.changes.length).toBeGreaterThan(0)
    const second = repairNetwork(first.network, curation)
    expect(second.log.changes).toEqual([])
    expect(second.network).toEqual(first.network)
  })
})
