import { z } from 'zod'

export const addTenancyReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  // Long enough to say something, short enough that a review stays a review.
  content: z.string().trim().min(10).max(1000),
})

export const listTenanciesQuerySchema = z.object({
  hat: z.enum(['tenant', 'owner']).default('tenant'),
})
