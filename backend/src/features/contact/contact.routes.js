import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import { ok } from '../../utils/response.js'
import { submitContactMessage } from './contact.service.js'

const router = Router()

// The four the form offers. A closed enum rather than a free string: the value
// goes into the subject line, and a subject line is where an open field becomes
// a way to make our own mail look like something it isn't.
export const CONTACT_TOPICS = ['question', 'report', 'partnership', 'other']

const contactSchema = z.object({
  name:    z.string().trim().min(1).max(80),
  email:   z.string().trim().email().max(200),
  topic:   z.enum(CONTACT_TOPICS),
  // 1000 matches the form's own counter. The 2mb body limit would let a
  // stranger post a novel into our inbox otherwise.
  message: z.string().trim().min(1).max(1000),
})

// PUBLIC and unauthenticated — anyone can be locked out of their account and
// still need to reach us, which is most of the point of a contact form.
// `strictLimiter` (20/15min per IP) is the same gate every other public
// user-generated-content route uses; the mailer's own daily cap is the
// backstop behind it.
router.post('/', strictLimiter, validate(contactSchema), async (req, res, next) => {
  try {
    const result = await submitContactMessage(req.body)
    ok(res, result, 'Message sent')
  } catch (err) { next(err) }
})

export default router
