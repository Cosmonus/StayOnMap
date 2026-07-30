import AsyncStorage from '@react-native-async-storage/async-storage'
import { listingDraftService } from '@services/listingDraft.service'
import { DRAFT_KEY, readSavedDraft, clearSavedDraft } from './draftStore'

// Keeps the local draft (draftStore.js's AsyncStorage slot) and the server's
// copy in step, so an owner can photograph a flat here and finish the pricing
// on a laptop.
//
// Mirrors frontend/src/features/listings/components/onboarding/draftSync.js —
// same conflict rule, same debounce, same split between "discard everywhere"
// and "clear this device". Keep the two in step; the whole feature is that they
// agree about one envelope.
//
// LOCAL STAYS THE SOURCE OF TRUTH FOR THE UI. Every read is still the plain
// AsyncStorage read it always was, so typing never waits on a request and the
// wizard works on a train exactly as it did before syncing existed. This module
// only moves bytes between that slot and the server.
//
// The conflict rule is last-write-wins on the envelope's `at`. Two devices
// editing the same draft in the same minute means the later stamp survives;
// a real limitation, accepted because this is one person with one draft slot.
// It also falls out well in the common case: someone actively typing has an
// `at` of a second ago, so a pull can never overwrite live work.

const PUSH_DELAY_MS = 2000

let pushTimer = null
let pending = null

// Signed out there is nothing to sync to, and every call would 401. Read from
// storage rather than passed in because this module is reached from sign-out
// itself, after the auth context has already let go of the user.
async function signedIn() {
  try {
    return !!(await AsyncStorage.getItem('user_token'))
  } catch {
    return false
  }
}

// Fetch the server's draft and adopt it only if it is genuinely newer than what
// is on this device. Never throws: a failed sync leaves the local draft exactly
// as it was, which is the pre-sync behaviour and a perfectly good fallback.
export async function pullDraft() {
  if (!(await signedIn())) return false
  try {
    const remote = await listingDraftService.get().then((r) => r.data)
    if (!remote?.categoryKey) return false

    const local = await readSavedDraft()
    if (local && (local.at ?? 0) >= (remote.at ?? 0)) return false

    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(remote))
    return true
  } catch {
    return false
  }
}

// Pull, then read — what every screen that shows the draft actually wants. The
// screens call this on focus, so returning to My Listings after starting a
// listing on the laptop shows it, rather than showing nothing until a restart.
export async function syncAndReadDraft() {
  await pullDraft()
  return readSavedDraft()
}

// Debounced, because the local write happens on every keystroke and the server
// does not need to hear about each one. The trailing edge is what matters —
// whatever the draft looked like when they stopped typing.
export function schedulePush(envelope) {
  pending = envelope
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(flushPush, PUSH_DELAY_MS)
}

// Send whatever is queued right now. Called when the wizard unmounts and when
// the app leaves the foreground: backgrounding two seconds after the last
// keystroke is exactly the moment someone puts the phone down and opens the
// laptop, and it is the one case where the debounce would otherwise lose the
// newest edit — Android can kill a backgrounded app before the timer fires.
export async function flushPush() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  const envelope = pending
  pending = null
  if (!envelope || !(await signedIn())) return
  await listingDraftService.put(envelope).catch(() => {
    /* offline or rejected — local still holds it, the next push retries */
  })
}

// Discard everywhere: publishing, an explicit delete, or starting over. Kept
// separate from draftStore's clearSavedDraft(), which is local only — that one
// also runs when the local copy is found expired or unparseable, and a corrupt
// copy here must never delete a good copy on the server.
export async function discardDraftEverywhere() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  pending = null
  await clearSavedDraft()
  if (!(await signedIn())) return
  await listingDraftService.remove().catch(() => {})
}

// Sign-out drops this device's copy without touching the server's. The draft is
// the account's, not the phone's: leaving it would hand the next person to sign
// in a stranger's half-written listing, which is how it behaved before the
// draft belonged to an account. Runs BEFORE the token is cleared, so it can
// still tell whether there is a session at all.
export async function clearLocalDraftOnSignOut() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  pending = null
  await clearSavedDraft()
}
