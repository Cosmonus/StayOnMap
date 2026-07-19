import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MODULES } from '../src/features/spatial/registry.js'

// Every backend module must be renderable on both platforms.
//
// This exists because two modules shipped and rendered NOWHERE: both panels
// had a hardcoded ORDER array and did `ORDER.map(key => modules[key])`, which
// silently dropped anything not listed — while the file's own comment claimed
// "adding a module never touches this file". The backend was correct, the
// tests were green, and the feature was invisible.
//
// Same class of failure as the amenity name drift that scripts/check-amenities.mjs
// was written for: a name that must line up across files and platforms, where
// every mismatch fails silently. So it gets the same treatment — a test, not a
// convention.
//
// Deliberately text matching rather than importing: these are JSX/RN modules in
// sibling packages with their own aliases and toolchains, and standing up a
// bundler here would cost more than it catches.

const ROOT = resolve(import.meta.dirname, '../..')

const SURFACES = [
  { name: 'web panel',    path: 'frontend/src/features/spatial/components/SpatialContextPanel.jsx' },
  { name: 'mobile panel', path: 'mobile/src/features/spatial/components/SpatialContextPanel.js' },
  { name: 'web meta',     path: 'frontend/src/features/spatial/meta.js' },
  { name: 'mobile meta',  path: 'mobile/src/features/spatial/meta.js' },
]

describe('spatial module UI parity', () => {
  for (const surface of SURFACES) {
    const file = resolve(ROOT, surface.path)

    it(`${surface.name} knows every backend module`, () => {
      // A missing file is a real failure, not a skip — silently passing when
      // the path moves is how this check would rot into decoration.
      expect(existsSync(file), `${surface.path} not found`).toBe(true)
      const source = readFileSync(file, 'utf8')

      for (const module of MODULES) {
        expect(
          source.includes(`'${module.key}'`) || source.includes(`${module.key}:`),
          `${surface.path} has no entry for module "${module.key}" — it would render ` +
          'as an unlabelled card, or not at all',
        ).toBe(true)
      }
    })
  }

  it('both panels append unknown module keys rather than dropping them', () => {
    // The specific regression: ORDER.map() discards anything unlisted. Ordering
    // is a presentation choice and may drift; silently losing a module is not.
    for (const surface of SURFACES.filter((s) => s.name.endsWith('panel'))) {
      const source = readFileSync(resolve(ROOT, surface.path), 'utf8')
      expect(
        source.includes('inRenderOrder'),
        `${surface.path} must route modules through inRenderOrder, which keeps ` +
        'keys the ORDER list has not heard of',
      ).toBe(true)
    }
  })

  it('the two platforms order modules identically', () => {
    const orderOf = (path) => {
      const source = readFileSync(resolve(ROOT, path), 'utf8')
      const block = source.match(/const ORDER = \[([\s\S]*?)\]/)
      return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
    }

    expect(orderOf('mobile/src/features/spatial/components/SpatialContextPanel.js'))
      .toEqual(orderOf('frontend/src/features/spatial/components/SpatialContextPanel.jsx'))
  })
})
