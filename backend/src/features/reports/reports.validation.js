import { z } from 'zod'
export const createReportSchema = z.object({
  category: z.enum(['FRAUD','FAKE_PHOTOS','UNAUTHORIZED_LISTING','WRONG_PRICING','UNSAFE','ILLEGAL','HARASSMENT','OWNER_MISCONDUCT','DUPLICATE','FALSE_INFO','NOISE','WATER','SECURITY','BROKER_SPAM','OTHER']),
  description: z.string().min(20).max(2000),
  severity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
  evidenceUrls: z.array(z.string().url()).max(5).default([]),
  isAnonymous: z.boolean().default(false),
})
export const moderateReportSchema = z.object({
  action: z.enum(['APPROVE','REJECT','SUSPEND','INVESTIGATE','DISMISS','WARN_OWNER']),
  note: z.string().max(500).optional(),
})
export const ownerRespondSchema = z.object({
  ownerResponse: z.string().min(10).max(1000),
})
