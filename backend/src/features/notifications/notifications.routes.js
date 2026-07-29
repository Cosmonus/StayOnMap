import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { notificationListQuerySchema, markAllReadQuerySchema } from './notifications.validation.js'
import * as ctrl from './notifications.controller.js'

const router = Router()
router.use(authMiddleware)
router.get('/', validate(notificationListQuerySchema, 'query'), ctrl.list)
// Before '/:id'-shaped routes, same rule as everywhere else in this codebase.
router.get('/unread', ctrl.unread)
router.patch('/read-all', validate(markAllReadQuerySchema, 'query'), ctrl.markAll)
router.patch('/:id/read', ctrl.markOne)

export default router
