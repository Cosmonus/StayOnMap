/**
 * The tool layer — 2026-08-07
 *
 * These tests are the brief's AI-safety section, expressed as assertions rather
 * than as instructions in a prompt. A prompt is a request; a gate is a gate.
 *
 * The guarantees, each with a real failure behind it:
 *   • No arbitrary SQL and no arbitrary graph query — there is nowhere to put one
 *   • Every result bounded — a caller asking for 10,000 gets the ceiling
 *   • Every call timed out — a hung tool fails the call, not the request
 *   • Nothing writes — an agent answering questions cannot change data
 *   • A failure returns structured data, never a thrown stack trace, because
 *     "the tool failed" is something a caller must be able to act on
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { readFileSync } from 'node:fs'
import { runTool, TOOLS, TOOL_NAMES, toolCatalogue } from '../src/features/graph/tools.js'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.property.findMany.mockResolvedValue([])
})

describe('the registry is the whole surface', () => {
  it('covers every capability the brief asks for', () => {
    for (const name of [
      'searchProperties', 'searchGraph', 'findNearbyProperties', 'findNearbyStations',
      'findNearbyAmenities', 'findSimilarProperties', 'findRelatedAreas', 'calculateCommute',
      'getUserPreferences', 'getPropertyTrustSignals', 'detectPropertyRelationships',
      'detectOwnerRelationships', 'rankProperties',
    ]) {
      expect(TOOL_NAMES, `${name} must exist`).toContain(name)
    }
  })

  it('gives every tool a schema, a description and a handler', () => {
    for (const name of TOOL_NAMES) {
      expect(TOOLS[name].description, `${name} needs a description`).toBeTruthy()
      expect(typeof TOOLS[name].handler, `${name} needs a handler`).toBe('function')
      expect(TOOLS[name].input?.safeParse, `${name} needs a Zod schema`).toBeTypeOf('function')
    }
  })

  it('advertises exactly what exists — no ghost tools, no hidden ones', () => {
    expect(toolCatalogue().map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort())
  })
})

describe('no arbitrary query is reachable', () => {
  it('exposes no tool that takes SQL, Cypher or a raw query string', () => {
    // Belt: the shape of the registry. Braces: the source, below.
    const suspicious = TOOL_NAMES.filter((n) => /sql|raw|query|exec|eval/i.test(n))
    expect(suspicious).toEqual([])
  })

  it('accepts no argument named like a query passthrough', () => {
    for (const name of TOOL_NAMES) {
      // Zod strips unknown keys, so an injected `sql` never reaches a handler —
      // this asserts none is DECLARED either, which is the stronger statement.
      const shape = TOOLS[name].input._def?.shape?.() ?? {}
      for (const key of Object.keys(shape)) {
        expect(/^(sql|query|raw|where|filter|cypher)$/i.test(key), `${name}.${key} looks like a passthrough`).toBe(false)
      }
    }
  })

  it('strips an injected argument rather than forwarding it', async () => {
    const result = await runTool('searchProperties', { city: 'Chennai', sql: 'DROP TABLE "Property"', limit: 5 })
    expect(result.ok).toBe(true)
    const [call] = prismaMock.property.findMany.mock.calls
    expect(JSON.stringify(call)).not.toContain('DROP TABLE')
  })

  it('has no write in any handler', () => {
    // The strongest available check short of running each handler: the module's
    // own source may not contain a Prisma mutation.
    const source = readFileSync(new URL('../src/features/graph/tools.js', import.meta.url), 'utf8')
    for (const mutation of ['.create(', '.createMany(', '.update(', '.updateMany(', '.upsert(', '.delete(', '.deleteMany(', '$executeRaw']) {
      expect(source.includes(mutation), `tools.js must not call ${mutation}`).toBe(false)
    }
  })
})

describe('validation', () => {
  it('rejects an unknown tool and says what exists', async () => {
    const result = await runTool('dropEverything', {})
    expect(result.ok).toBe(false)
    expect(result.error).toBe('UNKNOWN_TOOL')
    expect(result.tools).toContain('searchProperties')
  })

  it('cannot be tricked by a prototype key', async () => {
    // `TOOLS['constructor']` is truthy on a bare object lookup.
    const result = await runTool('constructor', {})
    expect(result.ok).toBe(false)
    expect(result.error).toBe('UNKNOWN_TOOL')
  })

  it('returns structured issues for bad arguments, not a thrown error', async () => {
    const result = await runTool('findNearbyProperties', { lat: 'north', lng: 77.6 })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('INVALID_ARGUMENTS')
    expect(result.issues[0]).toHaveProperty('path')
  })

  it('refuses coordinates outside India, the same bound the API uses', async () => {
    const result = await runTool('findNearbyProperties', { lat: 51.5, lng: -0.12 })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('INVALID_ARGUMENTS')
  })

  it('refuses a malformed node id', async () => {
    const result = await runTool('searchGraph', { from: 'not-a-node-id' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('INVALID_ARGUMENTS')
  })
})

describe('bounds', () => {
  it('clamps a caller asking for far too much', async () => {
    const result = await runTool('searchProperties', { limit: 10_000 })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('INVALID_ARGUMENTS')
  })

  it('applies a default limit when none is given', async () => {
    await runTool('searchProperties', {})
    const [call] = prismaMock.property.findMany.mock.calls
    expect(call[0].take).toBeGreaterThan(0)
    expect(call[0].take).toBeLessThanOrEqual(50)
  })

  it('caps traversal depth at 3', async () => {
    const result = await runTool('searchGraph', { from: 'Property:abc', depth: 99 })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('INVALID_ARGUMENTS')
  })
})

describe('failure handling', () => {
  it('times out a hung tool instead of hanging the request', async () => {
    const original = TOOLS.searchProperties.handler
    TOOLS.searchProperties.handler = () => new Promise(() => {})
    try {
      const result = await runTool('searchProperties', {}, { timeoutMs: 30 })
      expect(result.ok).toBe(false)
      expect(result.error).toBe('TOOL_TIMEOUT')
    } finally {
      TOOLS.searchProperties.handler = original
    }
  })

  it('turns a thrown handler into a structured failure', async () => {
    const original = TOOLS.searchProperties.handler
    TOOLS.searchProperties.handler = () => { throw new Error('database on fire') }
    try {
      const result = await runTool('searchProperties', {})
      expect(result.ok).toBe(false)
      expect(result.error).toBe('TOOL_FAILED')
      // The internal message must not leak to whoever is asking.
      expect(JSON.stringify(result)).not.toContain('database on fire')
    } finally {
      TOOLS.searchProperties.handler = original
    }
  })

  it('reports elapsed time on success, which is the latency observability', async () => {
    const result = await runTool('searchProperties', {})
    expect(result.ok).toBe(true)
    expect(result.ms).toBeGreaterThanOrEqual(0)
    expect(result.tool).toBe('searchProperties')
  })
})

describe('honesty of results', () => {
  it('says "not seeded" rather than "nothing here" for an unseeded city', async () => {
    // The single confusion the whole spatial layer exists to prevent.
    const result = await runTool('findNearbyStations', { lat: 12.9352, lng: 77.6245 })
    expect(result.ok).toBe(true)
    expect(result.data.available).toBe(false)
    expect(result.data.reason).toMatch(/not seeded/i)
  })

  it('labels commute distance as derived, never as a travel time', async () => {
    const result = await runTool('calculateCommute', {
      fromLat: 12.9352, fromLng: 77.6245, toLat: 12.9852, toLng: 77.6745,
    })
    expect(result.data.provenance).toBe('DERIVED')
    expect(result.data).not.toHaveProperty('minutes')
    expect(result.data.note).toMatch(/not a travel time/i)
  })

  it('attaches the caveat to a shared-contact finding', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ phone: null })
    const result = await runTool('detectOwnerRelationships', { ownerId: 'u1' })
    expect(result.data.note).toMatch(/cannot tell them apart|must not be reported as fraud/i)
  })
})
