import { useEffect, useRef, useState } from 'react'

// A listing takes photos, a pin and a price — an owner will close the tab
// halfway through, and before this they lost everything. The draft lives in
// localStorage from the first keystroke; "Save & exit" is then just leaving.
//
// Only the draft is stored, never anything the server owns: images are
// already uploaded URLs by the time they reach the draft, so a restored draft
// points at real files rather than lost blobs.
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

export function clearSavedDraft() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
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
export default function useDraftAutosave({ stage, categoryKey, stepIdx, draft, setCategoryKey, setStepIdx, setDraft, paused = false }) {
  const [savedAt, setSavedAt] = useState(null)
  const restored = useRef(false)

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
      setStepIdx(saved.stepIdx ?? 0)
      setSavedAt(saved.at)
    } catch { clearSavedDraft() }
  }, [paused, stage, categoryKey, setCategoryKey, setDraft, setStepIdx])

  useEffect(() => {
    if (paused || stage !== 'flow' || !categoryKey) return
    const at = Date.now()
    try {
      localStorage.setItem(KEY, JSON.stringify({ categoryKey, stepIdx, draft, at }))
      setSavedAt(at)
    } catch { /* quota or private mode — the wizard still works, just not resumable */ }
  }, [paused, stage, categoryKey, stepIdx, draft])

  return savedAt
}
