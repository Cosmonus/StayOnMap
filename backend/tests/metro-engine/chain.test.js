/**
 * Way chaining — the fix for the original "teleporting lines" bug (ways
 * concatenated in arbitrary Overpass return order). Members arrive in
 * relation order; each way must be oriented to fit the growing chain, and a
 * genuine gap must open a new component, never a fake bridge.
 */

import { describe, it, expect } from 'vitest'
import { chainWayMembers } from '../../src/metro-engine/parse/chain.js'

// ~111m per 0.001° lat at these latitudes.
const P = [
  [23.0, 72.5],
  [23.001, 72.5],
  [23.002, 72.5],
  [23.003, 72.5],
]

const way = (coords, role = '') => ({ type: 'way', ref: Math.random(), role, geometry: coords.map(([lat, lon]) => ({ lat, lon })) })

describe('chainWayMembers', () => {
  it('chains in-order ways into one component, deduplicating the shared node', () => {
    const { components, log } = chainWayMembers([way([P[0], P[1], P[2]]), way([P[2], P[3]])])
    expect(components).toEqual([[P[0], P[1], P[2], P[3]]])
    expect(log.breaks).toBe(0)
  })

  it('flips a way whose point order runs against the chain', () => {
    const { components } = chainWayMembers([way([P[0], P[1], P[2]]), way([P[3], P[2]])])
    expect(components).toEqual([[P[0], P[1], P[2], P[3]]])
  })

  it('prepends when the relation lists the far end first', () => {
    const { components } = chainWayMembers([way([P[2], P[3]]), way([P[0], P[1], P[2]])])
    expect(components).toEqual([[P[0], P[1], P[2], P[3]]])
  })

  it('opens a new component at a genuine gap instead of bridging it', () => {
    const far = [[23.1, 72.6], [23.101, 72.6]]
    const { components, log } = chainWayMembers([way([P[0], P[1]]), way(far)])
    expect(components).toEqual([[P[0], P[1]], far])
    expect(log.breaks).toBe(1)
  })

  it('ignores platform members — street furniture, not track', () => {
    const { components } = chainWayMembers([
      way([P[0], P[1]]),
      way([[23.0005, 72.5001], [23.0006, 72.5001]], 'platform'),
      way([P[1], P[2]]),
    ])
    expect(components).toEqual([[P[0], P[1], P[2]]])
  })

  it('joins ways meeting within snap tolerance without sharing a node, keeping all points', () => {
    const nearStart = [23.00127, 72.5] // ~30m past P[1]
    const { components } = chainWayMembers([way([P[0], P[1]]), way([nearStart, P[2]])])
    expect(components).toEqual([[P[0], P[1], nearStart, P[2]]])
  })
})
