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
  // How long the form was open, in ms. Optional and forgeable, which is why
  // features/reviews/integrity.js only ever lets a SMALL value raise
  // suspicion — omitting it or inflating it buys nothing. Not a column: the
  // service strips it before the write.
  composeMs: z.number().int().min(0).max(86_400_000).optional(),
})

// `vote` read req.body.recommend and `ownerRespond` read req.body.response
// with no schema. A missing or non-boolean `recommend` reached Prisma and
// threw a 500 for what is a malformed request; an unbounded `response`
// persisted and rendered under every review on the listing.
export const voteSchema = z.object({
  recommend: z.boolean(),
})

export const reviewResponseSchema = z.object({
  // Empty clears the response — the service already maps falsy to null.
  response: z.string().trim().max(2000).optional(),
})
