import { z } from 'zod'

export const createLeaseSchema = z.object({
  tenantId:      z.string().min(1),
  startDate:     z.string().datetime(),
  endDate:       z.string().datetime(),
  rentAmount:    z.number().positive(),
  depositAmount: z.number().positive(),
  ownerNote:     z.string().max(500).optional(),
})

export const signLeaseSchema = z.object({
  tenantNote: z.string().max(500).optional(),
})

export const terminateLeaseSchema = z.object({
  ownerNote: z.string().max(500).optional(),
})
