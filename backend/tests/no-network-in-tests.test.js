// The test suite must not touch the network. This enforces it structurally.
//
// Twice now a network-calling provider has been added to the spatial layer and
// NOT added to tests/setup.js's mock block:
//
//   2026-07-28  landCover()  — range-reads a GeoTIFF from S3. Made
//                              spatial-modules.test.js pass alone and fail in
//                              the suite depending on whether S3 answered.
//   2026-07-30  elevation()  — hits OpenTopoData, a free rate-limited public
//                              API, with a 15s internal timeout against
//                              vitest's 5s default. Failed CI and blocked a
//                              deploy.
//
// Both were invisible to every existing test, because the symptom is a TIMEOUT
// in an unrelated file rather than an assertion failure — and both looked like
// flakes, which is the most expensive kind of bug to have in a gate that
// blocks every deploy.
//
// The Google-backed providers were never the problem: `env.googleMapsKey` is
// null in tests, so they return early without a request. That is precisely
// what made the gap hard to see — the block LOOKS complete, and it is complete
// for every provider that happens to need a Google key. A provider on a
// keyless public API sails straight through.
//
// So the rule this file encodes is not "mock the Google providers", it is:
// **every exported async function in a provider module is assumed to make a
// network call, and must be mocked in setup.js.** Opt out explicitly below if
// one genuinely doesn't.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BACKEND = resolve(import.meta.dirname, '..')

const PROVIDER_MODULES = [
  'src/features/spatial/providers.js',
  'src/features/spatial/worldCoverProvider.js',
]

// Exported async functions that provably make no outbound request. Keep this
// list tiny and justify every entry — it is the escape hatch that could let
// the bug back in.
const NO_NETWORK = new Set([])

const setup = readFileSync(resolve(BACKEND, 'tests/setup.js'), 'utf8')

function exportedAsyncFns(relPath) {
  const src = readFileSync(resolve(BACKEND, relPath), 'utf8')
  return [...src.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map((m) => m[1])
}

// The mock factory for a given module path, so a name mocked for a DIFFERENT
// module doesn't count as covering this one.
function mockBlockFor(relPath) {
  const specifier = '../' + relPath.replace(/^src\//, 'src/')
  const idx = setup.indexOf(`vi.mock('${specifier}'`)
  if (idx === -1) return null
  // Take everything up to the start of the next vi.mock (or EOF).
  const next = setup.indexOf('vi.mock(', idx + 8)
  return setup.slice(idx, next === -1 ? undefined : next)
}

describe('no network in tests', () => {
  for (const relPath of PROVIDER_MODULES) {
    describe(relPath, () => {
      const fns = exportedAsyncFns(relPath)

      it('is mocked in tests/setup.js at all', () => {
        expect(mockBlockFor(relPath), `${relPath} has no vi.mock in setup.js`).not.toBeNull()
      })

      it('exports at least one async function (guard against a silent no-op test)', () => {
        expect(fns.length).toBeGreaterThan(0)
      })

      for (const fn of fns) {
        if (NO_NETWORK.has(fn)) continue
        it(`${fn}() is stubbed`, () => {
          const block = mockBlockFor(relPath) ?? ''
          expect(
            new RegExp(`\\b${fn}\\s*:`).test(block),
            [
              `${fn}() is exported by ${relPath} but is not stubbed in tests/setup.js.`,
              'Every provider export is assumed to make a network call. Add:',
              `    ${fn}: vi.fn().mockResolvedValue(null),`,
              "to that module's vi.mock factory — or add it to NO_NETWORK here",
              'with a note explaining why it makes no request.',
            ].join('\n'),
          ).toBe(true)
        })
      }
    })
  }

  it('setup.js still claims to be the no-network boundary', () => {
    // If someone deletes the block wholesale, the per-function tests above
    // would also fail — but this gives a clearer message about intent.
    expect(setup).toMatch(/no network in tests/i)
  })
})
