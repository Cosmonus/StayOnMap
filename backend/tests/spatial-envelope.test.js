import { describe, it, expect } from 'vitest'
import {
  fact, PROVENANCE, STATUS, bandFor, computeConfidence, buildEnvelope, unavailableEnvelope,
} from '../src/features/spatial/envelope.js'

// These tests guard the three rules that make the layer honest rather than
// merely informative. If one of them starts passing garbage, the product is
// back to generating scores. See docs/spatial-intelligence.md §5.0.

describe('fact() — the provenance contract', () => {
  const base = {
    key: 'nearest_metro', label: 'Nearest metro', value: 420, unit: 'm',
    display: '420 m', source: 'osm-metro',
  }

  it('accepts a well-formed MEASURED fact', () => {
    const f = fact({ ...base, provenance: PROVENANCE.MEASURED })
    expect(f.provenance).toBe('MEASURED')
    expect(f.method).toBeNull()
  })

  it('rejects a fact with no provenance — the whole point of the layer', () => {
    expect(() => fact({ ...base })).toThrow(/provenance must be one of/)
    expect(() => fact({ ...base, provenance: 'PROBABLY' })).toThrow(/provenance must be one of/)
  })

  it('rejects an ESTIMATED fact with no method', () => {
    expect(() => fact({ ...base, provenance: PROVENANCE.ESTIMATED }))
      .toThrow(/must carry a plain-language method/)
  })

  it('accepts an ESTIMATED fact that explains itself', () => {
    const f = fact({
      ...base, provenance: PROVENANCE.ESTIMATED,
      method: 'straight-line distance x 1.35 at 4.8 km/h',
    })
    expect(f.method).toContain('4.8 km/h')
  })

  it('rejects facts missing the fields a user would need to read it', () => {
    expect(() => fact({ ...base, key: undefined, provenance: PROVENANCE.MEASURED })).toThrow(/key is required/)
    expect(() => fact({ ...base, label: undefined, provenance: PROVENANCE.MEASURED })).toThrow(/label is required/)
    expect(() => fact({ ...base, display: undefined, provenance: PROVENANCE.MEASURED })).toThrow(/display is required/)
    expect(() => fact({ ...base, source: undefined, provenance: PROVENANCE.MEASURED })).toThrow(/source is required/)
  })

  it('normalises a known-absent value to null rather than dropping the fact', () => {
    const f = fact({ ...base, value: undefined, provenance: PROVENANCE.MEASURED })
    expect(f.value).toBeNull()
  })
})

describe('computeConfidence() — computed, never authored', () => {
  const inputs = [
    { key: 'a', weight: 3 },
    { key: 'b', weight: 3 },
    { key: 'c', weight: 2 },
    { key: 'd', weight: 1 },
  ]

  it('is the weighted share of available inputs', () => {
    // a + c = 5 of 9
    expect(computeConfidence(inputs, ['a', 'c']).value).toBe(0.56)
  })

  it('is 1.0 when everything is available and uncapped', () => {
    expect(computeConfidence(inputs, ['a', 'b', 'c', 'd']).value).toBe(1)
  })

  it('is 0 when nothing is available', () => {
    const c = computeConfidence(inputs, [])
    expect(c.value).toBe(0)
    expect(c.band).toBe('MINIMAL')
  })

  it('respects a module ceiling — a guess cannot report certainty', () => {
    // Noise estimation has every input it will ever have and is still a guess.
    const c = computeConfidence(inputs, ['a', 'b', 'c', 'd'], 0.45)
    expect(c.value).toBe(0.45)
    expect(c.band).toBe('LOW')
  })

  it('reports which inputs were missing, so the UI can say why', () => {
    const c = computeConfidence(inputs, ['a', 'b'])
    expect(c.inputsMissing).toEqual(['c', 'd'])
    expect(c.basis).toBe('2 of 4 expected inputs available')
  })

  it('ignores unknown keys rather than inflating the score', () => {
    expect(computeConfidence(inputs, ['a', 'nonsense']).value)
      .toBe(computeConfidence(inputs, ['a']).value)
  })

  it('does not divide by zero when a module declares no inputs', () => {
    expect(computeConfidence([], []).value).toBe(0)
  })
})

describe('bandFor()', () => {
  it('maps values to the four bands', () => {
    expect(bandFor(0.90)).toBe('HIGH')
    expect(bandFor(0.75)).toBe('HIGH')
    expect(bandFor(0.74)).toBe('MODERATE')
    expect(bandFor(0.50)).toBe('MODERATE')
    expect(bandFor(0.49)).toBe('LOW')
    expect(bandFor(0.25)).toBe('LOW')
    expect(bandFor(0.24)).toBe('MINIMAL')
    expect(bandFor(0)).toBe('MINIMAL')
  })
})

describe('buildEnvelope()', () => {
  const module = {
    key: 'mobility', version: 3, ttlHours: 24, maxConfidence: 0.85,
    inputs: [{ key: 'a', weight: 1 }, { key: 'b', weight: 1 }],
  }
  const aFact = fact({
    key: 'x', label: 'X', value: 1, display: '1',
    provenance: PROVENANCE.MEASURED, source: 's',
  })

  it('is OK only when every declared input was available', () => {
    const e = buildEnvelope(module, { facts: [aFact], inputsPresent: ['a', 'b'] })
    expect(e.status).toBe(STATUS.OK)
  })

  it('is PARTIAL when an input is missing but facts exist', () => {
    const e = buildEnvelope(module, { facts: [aFact], inputsPresent: ['a'] })
    expect(e.status).toBe(STATUS.PARTIAL)
  })

  it('is UNAVAILABLE with no facts — "we do not know", not a zero score', () => {
    const e = buildEnvelope(module, { facts: [], inputsPresent: ['a', 'b'] })
    expect(e.status).toBe(STATUS.UNAVAILABLE)
  })

  it('carries the module version so a formula change forces a recompute', () => {
    expect(buildEnvelope(module, { facts: [aFact], inputsPresent: ['a'] }).version).toBe(3)
  })

  it('sets staleAfter from the module ttl', () => {
    const e = buildEnvelope(module, { facts: [aFact], inputsPresent: ['a'] })
    const hours = (new Date(e.staleAfter) - new Date(e.computedAt)) / 3_600_000
    expect(hours).toBeCloseTo(24, 1)
  })

  it('expires an empty result fast, so it cannot outlive the missing data', () => {
    // infrastructure has a 30-day TTL and is UNAVAILABLE until the POI table is
    // seeded; inheriting that TTL meant a cell kept saying "no data for this
    // city" for a month after the data arrived.
    const e = buildEnvelope(module, { facts: [], inputsPresent: ['a', 'b'] })
    const hours = (new Date(e.staleAfter) - new Date(e.computedAt)) / 3_600_000
    expect(e.status).toBe(STATUS.UNAVAILABLE)
    expect(hours).toBeCloseTo(1, 1)
  })

  it('applies the module ceiling to confidence', () => {
    const e = buildEnvelope(module, { facts: [aFact], inputsPresent: ['a', 'b'] })
    expect(e.confidence.value).toBe(0.85)
  })
})

describe('unavailableEnvelope()', () => {
  const module = { key: 'environment', version: 1, inputs: [{ key: 'aq', weight: 1 }] }

  it('is still a full envelope, so the UI can say what is unknown and why', () => {
    const e = unavailableEnvelope(module, 'No air quality station within range.')
    expect(e.status).toBe(STATUS.UNAVAILABLE)
    expect(e.facts).toEqual([])
    expect(e.missing).toEqual(['No air quality station within range.'])
    expect(e.confidence.value).toBe(0)
    expect(e.confidence.inputsMissing).toEqual(['aq'])
  })

  it('retries sooner than a successful run — failures are usually transient', () => {
    const e = unavailableEnvelope(module, 'nope')
    const hours = (new Date(e.staleAfter) - new Date(e.computedAt)) / 3_600_000
    expect(hours).toBeCloseTo(1, 1)
  })
})
