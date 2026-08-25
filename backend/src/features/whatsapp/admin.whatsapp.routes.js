// Mounted at /api/v1/admin/whatsapp — adminAuthMiddleware on everything.
import { Router } from 'express'
import { z } from 'zod'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { ok } from '../../utils/response.js'
import * as service from './admin.whatsapp.service.js'

const listSchema = z.object({
  status: z.string().max(20).optional(),
  search: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
const funnelSchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })
const interveneSchema = z.object({
  action: z.enum(['cancel', 'retry_publish', 'nudge', 'message']),
  text: z.string().max(1000).optional(),
})

export const adminWhatsAppRouter = Router()
adminWhatsAppRouter.use(adminAuthMiddleware)

adminWhatsAppRouter.get('/funnel', validate(funnelSchema, 'query'), async (req, res, next) => {
  try { ok(res, await service.getFunnel(req.query)) } catch (err) { next(err) }
})
adminWhatsAppRouter.get('/conversations', validate(listSchema, 'query'), async (req, res, next) => {
  try { ok(res, await service.listConversations(req.query)) } catch (err) { next(err) }
})
adminWhatsAppRouter.get('/conversations/:id', async (req, res, next) => {
  try { ok(res, await service.getConversation(req.params.id)) } catch (err) { next(err) }
})
adminWhatsAppRouter.post('/conversations/:id/intervene', validate(interveneSchema), async (req, res, next) => {
  try { ok(res, await service.intervene(req.params.id, req.body, req.admin.sub)) } catch (err) { next(err) }
})
