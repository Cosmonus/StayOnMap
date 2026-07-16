import { z } from 'zod'

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(10000, 'Message too long').optional().default(''),
    attachmentUrl: z.string().url().optional(),
  })
  .refine((data) => data.body.length > 0 || !!data.attachmentUrl, {
    message: 'Message must have text or an attachment',
    path: ['body'],
  })

export const editMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
})

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty'),
})
