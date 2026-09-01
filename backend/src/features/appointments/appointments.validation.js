import { z } from 'zod'

export const createAppointmentSchema = z.object({
  requestedDate: z.string().datetime(),
  // SHORT_STAY only: the check-out of a stay request (requestedDate is then
  // the check-in). The service requires it for stays, ignores it otherwise —
  // which side of that line a property is on is a DB fact, not a client claim.
  checkOutDate: z.string().datetime().optional(),
  requestedTime: z.string().regex(/^\d{2}:\d{2}$/),
  message: z.string().max(500).optional(),
  contactNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
})

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED', 'CANCELLED']),
  // The owner's two fields.
  scheduledAt: z.string().datetime().optional(),
  ownerNote: z.string().max(300).optional(),
  // The renter's three, sent only with RESCHEDULE_REQUESTED. The schema is
  // shared by both parties, so it can only say these are WELL-FORMED — which
  // side is allowed to write which is enforced in the service, where the
  // caller's identity is known.
  requestedDate: z.string().datetime().optional(),
  requestedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tenantNote: z.string().max(300).optional(),
})
