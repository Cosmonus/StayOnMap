import { z } from 'zod'
export const createInsightSchema = z.object({
  category: z.enum(['WATER_SHORTAGE','SAFETY_CONCERN','QUIET_AREA','FAMILY_FRIENDLY','STUDENT_FRIENDLY','TRAFFIC','TRANSPORT','NOISE','OTHER']),
  body: z.string().min(10).max(500),
  isAnonymous: z.boolean().default(false),
})
