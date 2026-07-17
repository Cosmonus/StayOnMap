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
    // Declared without a starting value on purpose: the only value that
    // matters is the one assigned below, and seeding it with '' would just be
    // a value nothing ever reads.
    let output
    try {
      output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    } catch (err) {
      // Surface the checker's own report — it names each offending amenity —
      // while keeping the original error as `cause`, so the exit code and stack
      // survive instead of being replaced by this message.
      throw new Error(
        `check-amenities.mjs failed:\n${err.stdout ?? ''}${err.stderr ?? ''}`,
        { cause: err },
      )
    }
    // Deliberately outside the try: an assertion failure here must not be
    // caught and rethrown as "the checker failed", which would report an empty
    // stdout and hide what actually went wrong.
    expect(output).toContain('consistent')
  })
})
