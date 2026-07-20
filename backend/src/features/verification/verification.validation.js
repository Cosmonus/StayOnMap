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
export const addDocumentSchema = z.object({
  type: z.nativeEnum(VerificationDocType),
  url: z.string().url(),
})

export const adminReviewSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'SUSPENDED']),
  adminNote: z.string().max(500).optional(),
})

// The property address exactly as printed on the ownership document. Optional
// (verification predates this field) but bounded: an owner pasting their whole
// deed into it defeats the comparison it feeds.
export const submitVerificationSchema = z.object({
  documentAddress: z.string().trim().min(10).max(300).optional(),
})
