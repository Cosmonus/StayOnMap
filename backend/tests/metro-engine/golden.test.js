/**
 * Golden regression: a trimmed real Overpass capture (Ahmedabad's Blue Line
 * route_master, its two directional variants, and their member nodes) runs
 * through the full parser. Guards against regressions the synthetic fixtures
 * are too clean to catch — real member ordering, real stop tagging, real
 * parallel-track geometry.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { parseCity } from '../../src/metro-engine/parse/parse.js'
import { maxPathGapMeters, validateNetwork } from '../../src/lib/metro-validation/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envelope = JSON.parse(readFileSync(
  path.join(__dirname, '../fixtures/metro-engine/ahmedabad-blue-line.raw.json'), 'utf-8'
))
const NO_CURATION = { version: 1, cities: {} }

describe('golden: Ahmedabad Blue Line', () => {
  const { candidate, parseLog } = parseCity(envelope, NO_CURATION)

  it('merges the two directional variants into one continuous line', () => {
    expect(candidate.lines).toHaveLength(1)
    const line = candidate.lines[0]
    expect(line.name).toBe('Blue Line')
    expect(line.variantRelationIds).toHaveLength(2)
    expect(line.osmRouteMasterId).toBe(9522022)
    // Chained in relation order — no teleport jumps left in the kept variant.
    // (The residual ~790m max spacing is genuine sparse OSM point spacing on
    // a straight viaduct stretch, identical in both directions — under the
    // 2km gap threshold, so the line renders as one continuous polyline.)
    expect(maxPathGapMeters(line.path)).toBeLessThan(2000)
  })

  it('extracts stations from relation stop roles, all mapped to the line', () => {
    expect(parseLog.lines[0].stationMethod).toBe('relation-roles')
    expect(candidate.stations.length).toBeGreaterThanOrEqual(15)
    expect(candidate.stations.every((s) => s.lines.includes(0))).toBe(true)
    expect(candidate.stations.every((s) => typeof s.osmNodeId === 'number')).toBe(true)
  })

  it('yields zero validation errors as-parsed', () => {
    expect(validateNetwork(candidate).errors).toEqual([])
  })
})
