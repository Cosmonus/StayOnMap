import { z } from 'zod'

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(10000, 'Message too long').optional().default(''),
    attachmentUrl: z.string().url().optional(),
    // Document attachments (2026-07-26). The client echoes back what
    // POST /uploads/chat-file returned — the name is already sanitised there,
    // and capped again here because this is a public endpoint, not a trusted one.
    attachmentName: z.string().trim().max(120).optional(),
    attachmentMime: z.string().trim().max(100).optional(),
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
