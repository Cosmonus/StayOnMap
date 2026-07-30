// The ADD-listing wizard's steps on mobile — seven, where web has six.
//
// Web's step 1 is "Type & basics": the six category cards AND the question that
// choice unlocks AND up to five type-specific fields. That fits a two-column
// desktop step page. On a 360dp phone it is one long scroll where the decision
// shaping every later question scrolls off the top of the answers it shaped, so
// the cards get a screen of their own and everything they unlock moves to the
// next one.
//
// This list is MOBILE-ONLY and deliberately not in config/onboarding.js — that
// file is byte-identical across both platforms and is what
// backend/tests/wizard-sixtype-contract.test.js runs. Step KEYS still line up
// with it: missingRequirements() and the review step's Edit links address
// 'basics'/'location'/'photos'/'features'/'pricing', and every one of those
// still names a screen here. backend/tests/wizard-steps-parity.test.js fails if
// that stops being true.
//
// EditListingScreen keeps importing the shared six — its tabs are the five
// edit-able steps, and a live listing's type can't change anyway.
export const WIZARD_STEPS = [
  { k: 'type',     n: 1, label: 'What you’re listing', next: 'Basics' },
  { k: 'basics',   n: 2, label: 'Basics',              next: 'Location' },
  { k: 'location', n: 3, label: 'Location',            next: 'Photos' },
  { k: 'photos',   n: 4, label: 'Photos',              next: 'Features' },
  { k: 'features', n: 5, label: 'Features & words',    next: 'Price' },
  { k: 'pricing',  n: 6, label: 'Price',               next: 'Review' },
  { k: 'review',   n: 7, label: 'Review',              next: null },
]

// Drafts saved before the split carry a stepIdx into the SIX-step list, so
// reading one as an index into seven resumes on the wrong screen and tells the
// listings card you stopped somewhere you didn't. Envelopes carry `stepKey`
// now; a legacy index is read through the order it was written against.
const LEGACY_KEYS = ['basics', 'location', 'photos', 'features', 'pricing', 'review']

export function savedStepIndex(saved) {
  // Only a real number goes through LEGACY_KEYS — an envelope with neither key
  // nor index is a draft that has barely started, and that is step one, not
  // whatever LEGACY_KEYS happens to begin with.
  const legacy = typeof saved?.stepIdx === 'number' ? LEGACY_KEYS[saved.stepIdx] : null
  const key = saved?.stepKey ?? legacy
  const idx = key ? WIZARD_STEPS.findIndex((s) => s.k === key) : 0
  return idx === -1 ? 0 : idx
}

export function savedStep(saved) {
  return WIZARD_STEPS[savedStepIndex(saved)]
}
