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

  // ── Empty states ──────────────────────────────────────────────────────────
  // The panel's own guard was `envelopes.length === 0 && !pending && !children`,
  // and BOTH call sites pass children (the commute calculator) — so it could
  // never fire, and the section rendered its heading, its Beta pill and "tap any
  // card for the full report" above nothing at all. Three different conditions
  // produced that same blank: a failed lookup, an undescribed cell, and an area
  // with genuinely nothing mapped.
  //
  // A layer whose entire premise is "never show an unexplained number" must not
  // show an unexplained absence either. Text-matching for the same reason as
  // everything else in this file.
  const PANELS = SURFACES.filter((s) => s.name.endsWith('panel'))

  for (const surface of PANELS) {
    it(`${surface.name} distinguishes all four outcomes, not just two`, () => {
      const source = readFileSync(resolve(ROOT, surface.path), 'utf8')

      // Branch on `status`, not on the older two-valued `pending` boolean.
      expect(
        source.includes('status'),
        `${surface.path} must read the backend's status field — a boolean can ` +
        'only express two of the four real outcomes',
      ).toBe(true)

      for (const state of ['pending', 'failed', 'nothingMapped']) {
        expect(
          source.includes(state),
          `${surface.path} has no "${state}" branch — that outcome would fall ` +
          'through to a heading with no cards and no explanation',
        ).toBe(true)
      }
    })
  }

  it('neither panel gates its empty states on `children`', () => {
    // The exact dead-guard regression. `children` is always truthy at both call
    // sites, so any condition ANDed with `!children` is unreachable.
    for (const surface of PANELS) {
      const source = readFileSync(resolve(ROOT, surface.path), 'utf8')
      expect(
        source.includes('!children'),
        `${surface.path} gates on !children, which is always false at every ` +
        'call site — the guard cannot fire and the empty state never renders',
      ).toBe(false)
    }
  })

  it('both panels survive an envelope written by an older module shape', () => {
    // `modules` is raw JSON, so a row can predate the current envelope shape.
    // Indexing `.facts` on one of those throws mid-render and blanks the whole
    // section — strictly worse than the missing card it would have been.
    for (const surface of PANELS) {
      const source = readFileSync(resolve(ROOT, surface.path), 'utf8')
      expect(
        source.includes('Array.isArray(e.facts)'),
        `${surface.path} must guard that facts is an array before reading it`,
      ).toBe(true)
    }
  })

  // ── Confidence factors ────────────────────────────────────────────────────
  // The backend reduces confidence for things input availability can't see —
  // today an incomplete ETL fetch — and returns WHY alongside the number. A
  // platform that renders only the number shows a score that silently
  // disagrees with the other platform's, with nothing on screen accounting for
  // the gap. Same class of drift as the module-order bug above, so it gets the
  // same treatment.
  const METERS = [
    'frontend/src/features/spatial/components/ConfidenceMeter.jsx',
    'mobile/src/features/spatial/components/ConfidenceMeter.js',
  ]

  for (const path of METERS) {
    it(`${path.split('/')[0]} confidence meter renders the reduction reasons`, () => {
      const source = readFileSync(resolve(ROOT, path), 'utf8')

      expect(
        source.includes('confidence.factors'),
        `${path} ignores confidence.factors — the "why" half of the score is ` +
        'computed and thrown away',
      ).toBe(true)

      expect(
        source.includes('applied'),
        `${path} must filter to factors that actually bit; rendering the inert ` +
        'ones puts "this changed nothing" on a card',
      ).toBe(true)

      // Rows predate the factors field, so it is absent (not empty) on old
      // envelopes. Calling .filter on undefined throws mid-render and blanks
      // the card the caveat was meant to annotate.
      expect(
        source.includes('Array.isArray(confidence.factors)'),
        `${path} must guard that factors is an array before filtering it`,
      ).toBe(true)
    })
  }

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
