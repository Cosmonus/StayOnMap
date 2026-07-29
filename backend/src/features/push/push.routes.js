import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { webPushSubscribeSchema, webPushUnsubscribeSchema, expoTokenSchema } from './push.validation.js'
import { saveSubscription, removeSubscription } from '../../services/push.service.js'
import { saveExpoPushToken, removeExpoPushToken } from '../../services/expoPush.service.js'
import { ok } from '../../utils/response.js'
import { env } from '../../config/env.js'

const router = Router()

router.get('/vapid-public-key', (_req, res) => {
  ok(res, { key: env.vapidPublicKey ?? '' })
})

router.post('/subscribe', authMiddleware, validate(webPushSubscribeSchema), async (req, res, next) => {
  try {
    await saveSubscription(req.user.id, req.body)
    ok(res, { subscribed: true })
  } catch (err) { next(err) }
})

router.delete('/subscribe', authMiddleware, validate(webPushUnsubscribeSchema), async (req, res, next) => {
  try {
    await removeSubscription(req.user.id, req.body.endpoint)
    ok(res, { unsubscribed: true })
  } catch (err) { next(err) }
})

router.post('/register-device', authMiddleware, validate(expoTokenSchema), async (req, res, next) => {
  try {
    await saveExpoPushToken(req.user.id, req.body.token)
    ok(res, { registered: true })
  } catch (err) { next(err) }
})

router.delete('/unregister-device', authMiddleware, validate(expoTokenSchema), async (req, res, next) => {
  try {
    await removeExpoPushToken(req.user.id, req.body.token)
    ok(res, { unregistered: true })
  } catch (err) { next(err) }
})

export default router
