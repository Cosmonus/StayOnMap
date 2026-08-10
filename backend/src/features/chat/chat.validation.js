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

// Paging BACKWARDS through a thread. `before` is the id of the oldest message
// already on screen; the reply is the page before it. Absent → the newest page,
// which is what every released client asks for and gets.
export const messagesQuerySchema = z.object({
  before: z.string().trim().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
