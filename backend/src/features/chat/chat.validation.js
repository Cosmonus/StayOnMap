import { z } from 'zod'

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
})
