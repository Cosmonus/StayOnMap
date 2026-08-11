import { z } from 'zod'
import { indiaLat, indiaLng } from '../../utils/geo.js'
import { PRICING_MODELS, filterQueryShape } from '../properties/filters.registry.js'

// A saved search IS a saved /pins query — the same registry-generated shape,
// validated the same way, stored post-parse. That identity is the whole
// anti-drift design: the matcher replays it through buildFilterWhere(), so a
// saved search can never mean something the map would not have shown.
//
// Two deliberate differences from pinsQuerySchema:
//
//  - Bounds are OPTIONAL, all-or-nothing. The grid applies bounds only when
//    all four corners are present (`.claude/backend.md`'s listQuerySchema
//    note), and a saved search follows the grid's semantics, not the map's —
//    "anywhere in my filters" is a legitimate search. Half-given corners are
//    rejected rather than half-applied, because silently ignoring two corners
//    alerts someone about homes outside the box they drew.
//
//  - No proximity params. They live outside the registry, resolve against
//    cell state that changes underneath a stored search, and their
//    exclude-and-disclose contract (.claude/spatial.md) has no surface in a
//    push notification. Refusing them here is honest; accepting-and-ignoring
//    would make the saved search quietly broader than the screen it was saved
//    from.
const bounds = {
  swLat: indiaLat(z.coerce.number()).optional(),
  swLng: indiaLng(z.coerce.number()).optional(),
  neLat: indiaLat(z.coerce.number()).optional(),
  neLng: indiaLng(z.coerce.number()).optional(),
}

export const createSavedSearchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  query: z.object({
    ...filterQueryShape(),
    // Same server-side default as the public read path: "no pricingModel"
    // must mean RENT, or a lease listing's lakh-scale lump sum matches a
    // monthly-rent search (properties.validation.js says why at length).
    pricingModel: z.enum(PRICING_MODELS).default('RENT'),
    ...bounds,
  }).refine(
    (q) => {
      const given = [q.swLat, q.swLng, q.neLat, q.neLng].filter((v) => v !== undefined).length
      return given === 0 || given === 4
    },
    { message: 'Bounds need all four corners or none' }
  ),
})
