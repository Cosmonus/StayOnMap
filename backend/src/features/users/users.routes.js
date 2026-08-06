import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import { updateProfileSchema, reportUserSchema } from './users.validation.js'
import * as controller from './users.controller.js'

const router = Router()

router.get('/profile',         authMiddleware, controller.getProfile)
router.put('/profile',         authMiddleware, validate(updateProfileSchema), controller.updateProfile)
router.get('/settings',        authMiddleware, controller.getSettings)
router.get('/account-summary', authMiddleware, controller.getAccountSummary)
router.post('/change-password', authMiddleware, controller.changePassword)
router.delete('/account',      authMiddleware, controller.deleteAccount)

// ─── User safety ─────────────────────────────────────────────────────────────
// Registered BEFORE nothing in particular — there is no `/:id` route on this
// router to shadow — but keep `/blocked` above the `/:userId/*` pair anyway, so
// adding one later can't silently capture it.
router.get('/blocked',                    authMiddleware, controller.listBlockedUsers)
router.post('/:userId/block',             authMiddleware, controller.blockUser)
router.delete('/:userId/block',           authMiddleware, controller.unblockUser)
// strictLimiter: a report reaches a human moderator, so flooding the queue is
// the cheap attack. Blocking is not limited — it is self-protection, and
// rate-limiting someone's ability to stop harassment is the wrong trade.
router.post('/:userId/report',            authMiddleware, strictLimiter, validate(reportUserSchema), controller.reportUser)

export default router
