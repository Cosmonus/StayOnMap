import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  pullDraft, schedulePush, flushPush,
  subscribeDraftSync, getDraftSyncVersion,
} from './draftSync'
import { STEPS } from '../../config/onboarding.js'
import { savedStepIndex } from '../../config/wizardSteps.js'

// A listing takes photos, a pin and a price — an owner will close the tab
// halfway through, and before this they lost everything. The draft lives in
// localStorage from the first keystroke; "Save & exit" is then just leaving.
//
// Only the draft is stored, never anything the server owns: images are
// already uploaded URLs by the time they reach the draft, so a restored draft
// points at real files rather than lost blobs. That is also what lets the same
// draft open on another device (draftSync.js) — it points at uploaded files
// rather than at blobs that only this browser could resolve.
//
// localStorage stays the source of truth for the UI even so: every read below
// is synchronous, so typing never waits on the network and the wizard works
// offline exactly as it did before syncing existed.
const KEY = 'sn_listing_draft_v1'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export const EMPTY_DRAFT = {
  fields: {},
  amenityNames: [],
  rules: {},
  location: { address: '', city: '', state: '', pincode: '', landmark: '', lat: null, lng: null },
  images: [],
  title: '',
  titlePrefilled: false,
  description: '',
  // RENT unless the owner picks Lease on the price step (only offered for
  // LEASE_CATEGORIES). Lives beside `pricing` rather than inside it because
  // everything in `pricing` is a money string; this is a mode.
  pricingModel: 'RENT',
  pricing: {},
  terms: {},
  zeroBrokerage: true,
  brokerage: '',
  appointmentWindowStart: '',
  appointmentWindowEnd: '',
  instantBook: false,
  blockedDates: [],
}

// LOCAL ONLY — and that is the point of it being separate from
// discardDraftEverywhere() in draftSync.js. This one also runs when the local
// copy is found expired or unparseable, where deleting the server's copy would
// destroy a perfectly good draft on the strength of a corrupt one here.
export function clearSavedDraft() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
}

// Pull the account's draft into this browser, then report when it lands.
// Returns a version number that changes only when a pull actually adopted
// something newer than what was already here — components put it in an effect's
// deps to re-read localStorage. A draft synced from another device that nobody
// can see until a reload is the same as a draft that never synced.
//
// The pull is safe to run at any time: last-write-wins on `at` means someone
// mid-sentence has a stamp of a second ago and always beats the server's copy.
export function useDraftSync() {
  const version = useSyncExternalStore(subscribeDraftSync, getDraftSyncVersion, getDraftSyncVersion)

  useEffect(() => {
    pullDraft()

    // A tab going hidden is the moment someone picks up their phone, and it is
    // the one case the 2s push debounce would otherwise lose. 'pagehide' rather
    // than 'beforeunload': it fires on mobile Safari's bfcache path too, where
    // beforeunload does not.
    const flush = () => { if (document.visibilityState === 'hidden') flushPush() }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushPush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushPush)
      flushPush()
    }
  }, [])

  return version
}

// Peek at the saved draft without restoring it. The listings page needs this to
// tell the owner they have something unfinished — a draft nobody can find again
// is the same as a draft that was never saved.
export function readSavedDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved?.categoryKey || Date.now() - (saved.at ?? 0) > MAX_AGE_MS) return null
    return saved
  } catch {
    return null
  }
}

// `paused` holds BOTH effects — reading and writing — while the owner decides
// what to do about an existing draft. It has to hold the write too: there is one
// draft slot, so a single keystroke into a "new" listing would overwrite the
// saved one with nothing to undo it. Pausing is what makes "start fresh" a
// choice rather than a silent deletion.
export default function useDraftAutosave({ stage, categoryKey, stepIdx, draft, setCategoryKey, setStepIdx, setDraft, paused = false, syncVersion = 0 }) {
  const [savedAt, setSavedAt] = useState(null)
  const restored = useRef(false)

  // A pull that adopted a newer draft has to be allowed to seed the wizard, so
  // the once-only guard is released when one lands. It is still guarded by
  // `!categoryKey` below, which is what actually protects live typing.
  useEffect(() => { restored.current = false }, [syncVersion])

  // Restore once, and only into a flow that hasn't started — never clobber a
  // draft the owner is already typing into.
  useEffect(() => {
    if (paused || restored.current || stage !== 'flow' || categoryKey) return
    restored.current = true
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (!saved?.categoryKey || Date.now() - (saved.at ?? 0) > MAX_AGE_MS) { clearSavedDraft(); return }
      setCategoryKey(saved.categoryKey)
      setDraft({ ...EMPTY_DRAFT, ...saved.draft })
      // Not saved.stepIdx directly: an envelope written on mobile indexes a
      // SEVEN-step list. savedStepIndex reads the key instead.
      setStepIdx(savedStepIndex(saved))
      setSavedAt(saved.at)
    } catch { clearSavedDraft() }
  }, [paused, stage, categoryKey, syncVersion, setCategoryKey, setDraft, setStepIdx])

  useEffect(() => {
    if (paused || stage !== 'flow' || !categoryKey) return
    const at = Date.now()
    // `stepKey` is what makes this envelope readable by the other platform,
    // whose step list is a different length. `stepIdx` rides along unchanged so
    // a browser running an older build still resumes correctly.
    const envelope = { categoryKey, stepIdx, stepKey: STEPS[stepIdx]?.k, draft, at }
    try {
      localStorage.setItem(KEY, JSON.stringify(envelope))
      setSavedAt(at)
    } catch { /* quota or private mode — the wizard still works, just not resumable */ }
    // Local first, always: the server copy is for the owner's other device, and
    // it must never be the thing standing between a keystroke and it being safe.
    schedulePush(envelope)
  }, [paused, stage, categoryKey, stepIdx, draft])

  return savedAt
}
