/**
 * Amenity consistency — CI gate for scripts/check-amenities.mjs.
 *
 * An amenity name has to agree across four files (canonical list, wizard
 * chips, filter options, icon map) times two platforms, and every way of
 * getting it wrong fails silently: a chip the wizard drops on create, or a
 * filter that matches nothing forever. Six filters were dead this way until
 * 2026-07-17. Nothing else in the test suite would notice, so this runs the
 * checker as a test rather than trusting people to remember the script.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'check-amenities.mjs')

describe('amenity consistency', () => {
  it('passes check-amenities.mjs across seed, chips, filters and icons', () => {
    let output = ''
    try {
      output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    } catch (err) {
      // Surface the checker's own report — it names each offending amenity.
      throw new Error(`check-amenities.mjs failed:\n${err.stdout ?? ''}${err.stderr ?? ''}`)
    }
    expect(output).toContain('consistent')
  })
})
