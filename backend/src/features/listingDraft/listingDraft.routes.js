import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { putDraftSchema } from './listingDraft.validation.js'
import * as controller from './listingDraft.controller.js'

const router = Router()

// The draft belongs to whoever is signed in — there is no id in any of these
// paths, and there must not be. `req.user.id` is the only key, which is what
// makes another owner's unfinished listing unreachable by construction rather
// than by an ownership check somebody could forget to write.
router.use(authMiddleware)

router.get('/', controller.getMyDraft)
router.put('/', validate(putDraftSchema), controller.putMyDraft)
router.delete('/', controller.deleteMyDraft)

export default router
