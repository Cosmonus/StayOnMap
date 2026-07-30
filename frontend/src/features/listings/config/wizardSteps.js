import { STEPS } from './onboarding.js'

// Reading a saved draft's step back on WEB. The mirror of mobile's
// config/wizardSteps.js, and it exists for the same reason that file does: a
// raw `stepIdx` means different things depending on which platform wrote it.
//
// Web runs the shared six steps; mobile runs seven, because it splits the
// shared "Type & basics" into a type screen and a basics screen. Now that a
// draft crosses devices, an envelope saved on a phone at its step 4 (photos)
// would resume here at web's step 4 (features) if the index were trusted —
// one question further on than the owner actually got, with the skipped one
// silently blank. `stepKey` is what makes the envelope portable; the index is
// only a fallback for envelopes written before it existed.
//
// Pinned by backend/tests/wizard-steps-parity.test.js.
export function savedStepIndex(saved) {
  if (saved?.stepKey) {
    const idx = STEPS.findIndex((s) => s.k === saved.stepKey)
    // 'type' is mobile's own first screen and has no web equivalent — its
    // content is the front half of web's step 1, so step 1 is where it lands.
    // Any other unknown key means a step this build doesn't have; starting at
    // the beginning is the only honest answer.
    return idx === -1 ? 0 : idx
  }

  // No key: a draft written by a build that predates stepKey. Those only ever
  // came from web, whose indices already address this six-step list.
  return typeof saved?.stepIdx === 'number' && saved.stepIdx < STEPS.length
    ? saved.stepIdx
    : 0
}

export function savedStep(saved) {
  return STEPS[savedStepIndex(saved)]
}
