import { z } from 'zod'

// The six wizard categories. Declared here rather than imported from
// frontend/src/features/listings/config/onboarding.js — backend runtime code
// reaching across into frontend source would tie the API to a build artifact
// it doesn't ship. backend/tests/listing-draft.test.js compares this list
// against that shared config and fails if a seventh category appears on the
// clients without arriving here, which is the drift that would otherwise show
// up as a 400 nobody can explain.
export const CATEGORY_KEYS = ['apartment', 'house', 'land', 'pg', 'shop', 'stay']

// The step keys both wizards address. Mobile has seven steps to web's six (its
// 'type' screen is web's first step split in two), so the union is the
// vocabulary — `stepKey` is what makes an envelope portable between them, and
// rejecting a key one platform legitimately writes would strand its drafts.
export const STEP_KEYS = ['type', 'basics', 'location', 'photos', 'features', 'pricing', 'review']

// A draft is a half-answered form, so the FIELDS inside it are deliberately not
// validated: every one of them is optional by definition and the wizard gains
// new ones regularly. What is validated is the envelope — enough that a
// corrupted or hostile body can't be stored and handed back to a wizard that
// will try to render it.
//
// The size cap is the real protection. Nothing in a legitimate draft is large:
// images are already-uploaded URLs, not data, and the largest realistic draft
// is a few kilobytes. 64KB leaves two orders of magnitude of headroom while
// still refusing to become free per-user object storage.
export const MAX_PAYLOAD_BYTES = 64 * 1024

export const putDraftSchema = z
  .object({
    categoryKey: z.enum(CATEGORY_KEYS),
    // Legacy: web wrote only an index until stepKey arrived. Kept so an
    // envelope saved by a released build still round-trips.
    stepIdx: z.number().int().min(0).max(20).optional(),
    stepKey: z.enum(STEP_KEYS).optional(),
    draft: z.record(z.unknown()),
    // The client's own clock, and the tiebreak between two devices. Absent
    // means "stamp it on arrival" rather than "epoch", which would make every
    // such push instantly lose.
    at: z.number().int().positive().optional(),
  })
  .refine(
    (v) => Buffer.byteLength(JSON.stringify(v), 'utf8') <= MAX_PAYLOAD_BYTES,
    { message: 'Draft is too large to save' },
  )
