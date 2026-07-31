import { listingDraftService } from '@services/listingDraft.service'

// Keeps the local draft (useDraftAutosave's localStorage slot) and the server's
// copy in step, so an owner can photograph a flat on their phone and finish the
// pricing here.
//
// LOCAL STAYS THE SOURCE OF TRUTH FOR THE UI. Every read in the wizard is still
// a synchronous localStorage read — that is deliberate and worth keeping: it
// means typing never waits on a request, the wizard works offline exactly as it
// did before, and none of the existing call sites had to become async. This
// module only moves bytes between that slot and the server.
//
// The conflict rule is last-write-wins on the envelope's `at`. Two devices
// editing the same draft in the same minute means the later stamp survives;
// that is a real limitation, accepted because this is one person with one draft
// slot. It also falls out well in the common case: someone actively typing has
// an `at` of a second ago, so a pull can never overwrite live work.

const KEY = 'sn_listing_draft_v1'
const PUSH_DELAY_MS = 2000

let pushTimer = null
let pending = null
// Bumped whenever a pull actually adopted something. Components subscribe so a
// draft that arrives from another device shows up without a reload — a synced
// draft nobody can see is the same as a draft that never synced.
let version = 0
const listeners = new Set()

function announce() {
  version += 1
  for (const fn of listeners) fn()
}

export function subscribeDraftSync(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getDraftSyncVersion() {
  return version
}

// Signed out, there is nothing to sync to and every call would 401. Checked
// here rather than passed down because the draft's readers (the wizard, the
// listings overview) sit behind UserGuard but this module is also reached from
// sign-out itself.
function signedIn() {
  try {
    return !!localStorage.getItem('user_token')
  } catch {
    return false
  }
}

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Fetch the server's draft and adopt it only if it is genuinely newer than what
// is on this device. Returns true when local storage changed, so the caller can
// re-read. Never throws: a failed sync leaves the local draft exactly as it
// was, which is the pre-sync behaviour and a perfectly good fallback.
export async function pullDraft() {
  if (!signedIn()) return false
  try {
    const remote = await listingDraftService.get().then((r) => r.data)
    if (!remote?.categoryKey) return false

    const local = readLocal()
    if (local && (local.at ?? 0) >= (remote.at ?? 0)) return false

    localStorage.setItem(KEY, JSON.stringify(remote))
    announce()
    return true
  } catch {
    return false
  }
}

// Debounced, because the local write happens on every keystroke and the server
// does not need to hear about each one. The trailing edge is what matters —
// whatever the draft looked like when they stopped typing.
export function schedulePush(envelope) {
  if (!signedIn()) return
  pending = envelope
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(flushPush, PUSH_DELAY_MS)
}

// Send whatever is queued right now. Called when the wizard unmounts and when
// the tab is hidden: closing the laptop two seconds after the last keystroke is
// exactly the moment someone reaches for their phone, and it is the one case
// where the debounce would otherwise lose the newest edit.
export function flushPush() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  const envelope = pending
  pending = null
  if (!envelope || !signedIn()) return
  listingDraftService.put(envelope).catch(() => {
    /* offline or rejected — local still holds it, the next push retries */
  })
}

// Discard everywhere: publishing, an explicit delete, or starting fresh over an
// existing draft. Deliberately separate from clearSavedDraft(), which is local
// only — that one also runs when a local draft is found expired or corrupt, and
// a corrupt copy here must never delete a good copy on the server.
export async function discardDraftEverywhere() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  pending = null
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  if (!signedIn()) return
  await listingDraftService.remove().catch(() => {})
}

// Sign-out drops this device's copy without touching the server's. The draft is
// the account's, not the browser's: leaving it in localStorage would hand the
// next person to sign in on a shared machine a stranger's half-written listing,
// which is how it behaved before this existed.
export function clearLocalDraftOnSignOut() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  pending = null
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
}
