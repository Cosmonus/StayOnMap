import { z } from 'zod'
export const addDocumentSchema = z.object({
  type: z.enum(['GOVT_ID','PROPERTY_TAX','UTILITY_BILL','RENTAL_AGREEMENT','AADHAAR','PAN','SELFIE','OTHER']),
  url: z.string().url(),
})
export const adminReviewSchema = z.object({
  status: z.enum(['VERIFIED','REJECTED','UNDER_REVIEW','SUSPENDED']),
  adminNote: z.string().max(500).optional(),
})
