// Mounted at /api/v1/webhooks/whatsapp (the webhook) and /api/v1/whatsapp
// (the public sign-in link exchange) — see index.js.
//
// The webhook router parses its OWN body. The global express.json() discards
// the raw bytes, and Meta's signature is computed over exactly those bytes, so
// this router is mounted BEFORE the global parser with a `verify` hook that
// keeps them on req.rawBody. Nothing else on the API needs a raw body.
import { Router, json } from 'express'
import { z } from 'zod'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import * as controller from './whatsapp.controller.js'

export const webhookRouter = Router()

webhookRouter.get('/', controller.verify)
webhookRouter.post('/',
  json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf } }),
  controller.receive,
)

const exchangeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid link') })

export const publicRouter = Router()
publicRouter.post('/login-link/verify', strictLimiter, validate(exchangeSchema), controller.exchangeLoginLink)
