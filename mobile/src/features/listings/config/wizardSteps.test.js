/**
 * The wizard's step-key contract, and the cross-platform resume it protects.
 *
 * Mobile's ADD wizard has seven steps where web has six (the type picker gets
 * its own screen on a phone). A draft now follows the ACCOUNT rather than the
 * device, so the same half-written listing is resumed on both platforms — and
 * a `stepIdx` written against one list and read against the other resumes on
 * the wrong screen while telling the listings card you stopped somewhere you
 * did not.
 *
 * backend/tests/wizard-steps-parity.test.js pins the KEYS against web's shared
 * config. What that test cannot reach is the resolution logic here, which is
 * where the off-by-one actually lands.
 */
import { WIZARD_STEPS, savedStepIndex, savedStep } from './wizardSteps'

const KEY = (k) => WIZARD_STEPS.findIndex((s) => s.k === k)

describe('the step list itself', () => {
  it('has unique keys', () => {
    const keys = WIZARD_STEPS.map((s) => s.k)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('numbers steps 1..n in order, because the number is rendered as progress', () => {
    WIZARD_STEPS.forEach((s, i) => expect(s.n).toBe(i + 1))
  })

  it('chains `next` through every step and ends at null', () => {
    // A broken chain strands someone mid-listing with no forward button — the
    // one failure in this flow that loses work already typed.
    expect(WIZARD_STEPS.at(-1).next).toBeNull()
    WIZARD_STEPS.slice(0, -1).forEach((s) => expect(typeof s.next).toBe('string'))
  })

  it('still names every key the review step and missingRequirements() address', () => {
    // These five strings are hardcoded in the shared config's Edit links and in
    // missingRequirements(). Renaming a screen without renaming them sends
    // "fix this" to a step that does not exist.
    for (const k of ['basics', 'location', 'photos', 'features', 'pricing']) {
      expect(WIZARD_STEPS.some((s) => s.k === k)).toBe(true)
    }
  })
})

describe('resuming a saved draft', () => {
  it('resolves by key', () => {
    expect(savedStepIndex({ stepKey: 'photos' })).toBe(KEY('photos'))
    expect(savedStep({ stepKey: 'pricing' }).k).toBe('pricing')
  })

  it('reads a legacy six-step index through the list it was written against', () => {
    // stepIdx 2 in the OLD list is 'photos'. Read as an index into the new
    // seven-step list it would be 'location' — one step short, which is exactly
    // the bug a phone draft resumed on web produced.
    expect(savedStepIndex({ stepIdx: 2 })).toBe(KEY('photos'))
    expect(savedStepIndex({ stepIdx: 0 })).toBe(KEY('basics'))
  })

  it('prefers the key when a draft carries both', () => {
    expect(savedStepIndex({ stepKey: 'review', stepIdx: 0 })).toBe(KEY('review'))
  })

  it('starts at step one for an empty or unrecognised draft', () => {
    // Barely-started drafts have neither field. Falling back to LEGACY_KEYS[0]
    // here would skip the type picker — the one screen every later question
    // depends on.
    expect(savedStepIndex(undefined)).toBe(0)
    expect(savedStepIndex({})).toBe(0)
    expect(savedStepIndex({ stepKey: 'a-screen-that-was-deleted' })).toBe(0)
    expect(WIZARD_STEPS[0].k).toBe('type')
  })

  it('does not treat a stray stepIdx out of range as a step', () => {
    expect(savedStepIndex({ stepIdx: 99 })).toBe(0)
    expect(savedStepIndex({ stepIdx: -1 })).toBe(0)
  })
})
