import { z } from 'zod'
const rating = z.number().int().min(1).max(5)
export const createReviewSchema = z.object({
  reviewerType: z.enum(['TENANT', 'PREVIOUS_TENANT', 'NEIGHBOR', 'COMMUNITY']),
  recommend: z.boolean(),
  isAnonymous: z.boolean().default(false),
  ratingsSafety: rating,
  ratingsClean: rating,
  ratingsWater: rating,
  ratingsNoise: rating,
  ratingsInternet: rating,
  ratingsParking: rating,
  ratingsNeighborhood: rating,
  ratingsTransport: rating,
  ratingsMaintenance: rating,
  ratingsOwnerBehavior: rating,
  ratingsSecurity: rating,
  ratingsPowerBackup: rating,
  body: z.string().min(10).max(2000),
  mediaUrls: z.array(z.string().url()).max(5).default([]),
})
