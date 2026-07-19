/**
 * Compare stage: the diff a human reviews before a promote, and the gate
 * that keeps a worse candidate out of production.
 */

import { describe, it, expect } from 'vitest'
import { compareNetworks } from '../../src/metro-engine/compare/compare.js'

const track = (lng, n, fromLat = 23.0) =>
  Array.from({ length: n }, (_, i) => [fromLat + i * 0.001, lng])

const net = (lines, stations) => ({ city: 'Testville', lines, stations })
const line = (name, path, osmRelationId) => ({ name, color: '#123456', path, osmRelationId })
const station = (name, [lat, lng], lines = [0], osmNodeId) => ({ name, lat, lng, lines, osmNodeId })

describe('compareNetworks', () => {
  it('detects adds, removals, renames (by osm id), and moved stations', () => {
    const shipped = net(
      [line('Old Name', track(72.5, 10), 1), line('Gone Line', track(72.7, 10), 2)],
      [station('Alpha', [23.0, 72.5]), station('Moved', [23.001, 72.5])]
    )
    const candidate = net(
      [line('New Name', track(72.5, 10), 1), line('Fresh Line', track(72.9, 10), 3)],
      [station('Alpha', [23.0, 72.5], [0], 11), station('Moved', [23.002, 72.5], [0], 12), station('Beta', [23.003, 72.5], [1], 13)]
    )
    const report = compareNetworks(candidate, shipped)

    expect(report.lines.renamed).toEqual([{ from: 'Old Name', to: 'New Name' }])
    expect(report.lines.added).toEqual(['Fresh Line'])
    expect(report.lines.removed).toEqual(['Gone Line'])
    expect(report.stations.added).toEqual(['Beta'])
    expect(report.stations.moved).toEqual([{ name: 'Moved', meters: 111 }])
  })

  it('gate passes when the candidate is clean and no worse than shipped', () => {
    const network = net([line('A', track(72.5, 10), 1)], [station('Alpha', [23.0, 72.5], [0], 1)])
    expect(compareNetworks(network, network).gate.pass).toBe(true)
  })

  it('gate fails on a validation error (duplicate line names)', () => {
    const shipped = net([line('A', track(72.5, 10), 1)], [])
    const candidate = net([line('A', track(72.5, 10), 1), line('A', track(72.6, 10), 2)], [])
    const report = compareNetworks(candidate, shipped)
    expect(report.gate.pass).toBe(false)
    expect(report.gate.reasons[0]).toContain('validation error')
  })

  it('gate refuses an empty candidate when shipped has content — a failed fetch must never wipe a city', () => {
    const shipped = net([], [station('Alpha', [23.0, 72.5], [])])
    const report = compareNetworks(net([], []), shipped)
    expect(report.gate.pass).toBe(false)
    expect(report.gate.reasons[0]).toContain('empty')
  })
})
