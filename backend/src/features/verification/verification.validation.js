import { z } from 'zod'
import { VerificationDocType } from '@prisma/client'

// Sourced from the Prisma enum rather than a hand-copied list, because the
// hand-copied list drifted and broke real uploads: GST / TRADE_LICENSE /
// PATTA_TITLE / HOMESTAY_PERMIT were added to the schema (and to the host
// wizard's verify checklist) for the LAND/PG/COMMERCIAL/SHORT_STAY types but
// never here — so every document a land, PG, shop or short-stay owner
// submitted was rejected 400 and, because the wizard swallowed the error,
// silently vanished. The owner saw success; the admin saw an empty request.
// Fixed 2026-07-17; z.nativeEnum means this can never drift from the DB again.
//
// Identity documents PAUSED 2026-07-21 (operator decision): Aadhaar/PAN/
// govt-ID/selfie collection carries DPDP Act weight the platform is not
// taking on pre-launch — verification runs on property/business documents
// only. The enum VALUES stay (existing rows reference them; dropping a
// Postgres enum value is a destructive migration); new submissions are
// refused here and the pickers no longer offer them. Reversing this later
// is deleting IDENTITY_DOC_TYPES — after the legal review, not before.
const IDENTITY_DOC_TYPES = new Set(['AADHAAR', 'PAN', 'GOVT_ID', 'SELFIE'])

export const addDocumentSchema = z.object({
  type: z
    .nativeEnum(VerificationDocType)
    .refine((t) => !IDENTITY_DOC_TYPES.has(t), {
      message: 'Identity documents are not collected — upload a property or business document instead',
    }),
  url: z.string().url(),
})

export const adminReviewSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'SUSPENDED']),
  adminNote: z.string().max(500).optional(),
})

// GET /admin/verifications had NO query schema, so `page` and `limit` reached
// Prisma as the strings they arrive as on the wire. `take: "30"` throws
// ("Expected Int, provided String"), which meant a 500 on EVERY request the
// admin UI made — it always sends limit=30 — and the client rendered that
// failure as "No pending verifications". A real pending request sat invisible
// for weeks, and with it the only route to a VERIFIED_OWNER badge.
//
// z.coerce is the fix and the guard: the numbers can never reach Prisma as
// strings again, whatever a caller sends.
export const adminVerificationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// The property address exactly as printed on the ownership document. Optional
// (verification predates this field) but bounded: an owner pasting their whole
// deed into it defeats the comparison it feeds.
export const submitVerificationSchema = z.object({
  documentAddress: z.string().trim().min(10).max(300).optional(),
})
