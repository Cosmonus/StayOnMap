/**
 * Wizard step parity — the shared six vs mobile's seven — 2026-07-30
 *
 * frontend/src/features/listings/config/onboarding.js is run byte-for-byte by
 * both platforms' wizards, and its STEPS list is six. Mobile splits the first
 * of those ("Type & basics") into a type-picker screen and a basics screen,
 * because six category cards plus the question they unlock plus up to five
 * type fields is one scroll too long on a phone — so mobile's step list lives
 * separately, in mobile/src/features/listings/config/wizardSteps.js.
 *
 * That split is only safe while the step KEYS still line up: missingRequirements()
 * and the review step's Edit links (both in the shared config) address steps by
 * key — 'basics', 'location', 'photos', 'features', 'pricing' — and every one
 * of those must still name a screen mobile can jump to. A shared step added or
 * renamed without a matching mobile screen fails silently: the Edit link and the
 * "N things left before publish" chips just do nothing.
 *
 * It also pins the legacy-draft mapping. A draft saved before the split carries
 * an index into the SIX-step list, so `savedStepIndex` must read it through the
 * old order or an interrupted listing resumes on the wrong screen.
 */
import { describe, it, expect } from 'vitest'
import { STEPS as SHARED_STEPS } from '../../frontend/src/features/listings/config/onboarding.js'
import { WIZARD_STEPS as MOBILE_STEPS, savedStepIndex } from '../../mobile/src/features/listings/config/wizardSteps.js'

const MOBILE_ONLY = ['type']

describe('wizard steps: shared config vs mobile', () => {
  it('mobile has a screen for every shared step, in the same order', () => {
    const mobileKeys = MOBILE_STEPS.map((s) => s.k).filter((k) => !MOBILE_ONLY.includes(k))
    expect(mobileKeys).toEqual(SHARED_STEPS.map((s) => s.k))
  })

  it('mobile-only steps are exactly the declared ones', () => {
    const sharedKeys = SHARED_STEPS.map((s) => s.k)
    const extra = MOBILE_STEPS.map((s) => s.k).filter((k) => !sharedKeys.includes(k))
    expect(extra).toEqual(MOBILE_ONLY)
  })

  it('mobile step numbers are 1..n in order — the "Step N of 7" bar reads them', () => {
    expect(MOBILE_STEPS.map((s) => s.n)).toEqual(MOBILE_STEPS.map((_, i) => i + 1))
  })

  it('every step names the one after it, and only the last names nothing', () => {
    MOBILE_STEPS.forEach((step, i) => {
      if (i === MOBILE_STEPS.length - 1) {
        expect(step.next, `last step ${step.k}`).toBeNull()
        return
      }
      // `next` is the forward button's label ("Next — Photos"), so it has to
      // name the step that actually follows, not the one that used to.
      expect(MOBILE_STEPS[i + 1].label.startsWith(step.next), `${step.k} → ${step.next}`).toBe(true)
    })
  })
})

describe('resuming a saved draft', () => {
  it('reads a pre-split draft through the six-step order it was written against', () => {
    SHARED_STEPS.forEach((shared, oldIdx) => {
      const resumed = MOBILE_STEPS[savedStepIndex({ stepIdx: oldIdx })]
      expect(resumed.k, `legacy stepIdx ${oldIdx}`).toBe(shared.k)
    })
  })

  it('prefers the step key when the draft carries one', () => {
    expect(MOBILE_STEPS[savedStepIndex({ stepIdx: 0, stepKey: 'pricing' })].k).toBe('pricing')
  })

  it('falls back to the first step for an empty or unknown draft', () => {
    expect(savedStepIndex(null)).toBe(0)
    expect(savedStepIndex({ stepKey: 'gone' })).toBe(0)
  })
})
