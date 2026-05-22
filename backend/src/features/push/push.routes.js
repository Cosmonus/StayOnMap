import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { saveSubscription, removeSubscription } from '../../services/push.service.js'
import { ok } from '../../utils/response.js'
import { env } from '../../config/env.js'

const router = Router()

router.get('/vapid-public-key', (_req, res) => {
  ok(res, { key: env.vapidPublicKey ?? '' })
})

router.post('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    await saveSubscription(req.user.id, req.body)
    ok(res, { subscribed: true })
  } catch (err) { next(err) }
})

router.delete('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    await removeSubscription(req.user.id, req.body.endpoint)
    ok(res, { unsubscribed: true })
  } catch (err) { next(err) }
})

export default router
