import AsyncStorage from '@react-native-async-storage/async-storage'

// The wizard's autosave, in one place. It used to live inline in
// OnboardingWizard, which was fine while the wizard was the only reader — then
// the host dashboard needed to SHOW that an unfinished listing exists, and a
// second copy of the key and the shape is how the two quietly disagree.
//
// Mirrors web's useDraftAutosave: same key name, same envelope
// ({ categoryKey, stepIdx, draft, at }), same 14-day expiry.
//
// Read the step back with config/wizardSteps.js's savedStep/savedStepIndex,
// never `stepIdx` directly: mobile's wizard has seven steps to web's six, so a
// raw index means one thing in an envelope written before that split and
// another after. `stepKey` is the authoritative field; `stepIdx` is kept only
// so the envelope shape still matches web's.

export const DRAFT_KEY = 'sn_listing_draft_v1'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

// null for "nothing useful saved" — a missing key, unparseable JSON, a draft
// with no category chosen, or one old enough that resuming it would be stranger
// than starting over. Expired drafts are cleared as they are read.
export async function readSavedDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved?.categoryKey) return null
    if (Date.now() - (saved.at ?? 0) > MAX_AGE_MS) {
      await clearSavedDraft()
      return null
    }
    return saved
  } catch {
    await clearSavedDraft()
    return null
  }
}

export async function writeSavedDraft(envelope) {
  // Autosave failing is not worth interrupting typing over — the owner finds
  // out at the point they come back, which the dashboard banner covers.
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...envelope, at: Date.now() }))
  } catch {
    /* storage full or unavailable */
  }
}

export async function clearSavedDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY)
  } catch {
    /* nothing to undo */
  }
}
