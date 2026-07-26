import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { requireOwner } from '../../middlewares/requireOwner.middleware.js'
import * as controller from './host.controller.js'

const router = Router()

// Owner-only by construction: everything this returns is about the caller's own
// listings, and requireOwner keeps a tenant from discovering the shape of a
// surface that would be empty for them anyway.
router.get('/dashboard', authMiddleware, requireOwner, controller.getDashboard)

export default router
