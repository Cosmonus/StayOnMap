import { z } from 'zod'
import { CLIENT_EVENTS } from './events.js'

// Props are a small, closed bag — not "whatever the client sends". An open
// JSON column on a public endpoint is a free write-anything-you-like store,
// and it is also where PII arrives by accident (someone helpfully attaching an
// email to an event). Strings are capped so a single event cannot carry a
// payload.
const propValue = z.union([
  z.string().max(120),
  z.number(),
  z.boolean(),
])

const event = z.object({
  name: z.enum(CLIENT_EVENTS),
  // Client-generated and random. Capped so it cannot be used as storage.
  sessionId: z.string().trim().min(8).max(64),
  propertyId: z.string().max(40).optional(),
  city: z.string().max(60).optional(),
  props: z.record(propValue).optional(),
})

export const ingestSchema = z.object({
  // Batched: a browser sends one request per flush, not one per event. The cap
  // bounds a single request's work — the client flushes well below it.
  events: z.array(event).min(1).max(50),
  // Which client this is, so app traffic can be mirrored to GA4 and web
  // traffic left to the browser's own gtag (see features/analytics/ga4.js).
  //
  // OPTIONAL, and that is the point: every mobile build already on a phone
  // predates this field, and they must keep working untouched. Absent means
  // the server sniffs the User-Agent instead. It can be made required — and
  // the sniffing deleted — only once no build in the wild omits it.
  platform: z.enum(['web', 'app']).optional(),
})

export const funnelQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
})
