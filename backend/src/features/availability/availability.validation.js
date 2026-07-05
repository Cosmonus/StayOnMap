import { z } from 'zod'

// Bulk-replace payload — the wizard's calendar step sends the full set of
// blocked dates each time rather than incremental toggles.
export const setAvailabilitySchema = z.object({
  dates: z.array(z.object({
    date: z.string().datetime(),
    isBlocked: z.boolean().default(true),
  })).max(730),
})
