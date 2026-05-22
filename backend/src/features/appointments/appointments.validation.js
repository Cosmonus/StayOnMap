import { z } from 'zod'

export const createAppointmentSchema = z.object({
  requestedDate: z.string().datetime(),
  requestedTime: z.string().regex(/^\d{2}:\d{2}$/),
  message: z.string().max(500).optional(),
  contactNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
})

export const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'RESCHEDULED', 'CANCELLED']),
  scheduledAt: z.string().datetime().optional(),
  ownerNote: z.string().max(300).optional(),
})
