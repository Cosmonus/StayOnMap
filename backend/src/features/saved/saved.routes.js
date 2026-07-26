import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './saved.controller.js'

const router = Router()

router.use(authMiddleware) // all saved routes require auth

router.get('/', controller.getMySaved)
// Before '/:propertyId' would matter for a POST/DELETE, but this is a GET and
// those are POST/DELETE — kept adjacent to '/' for readability all the same.
router.get('/summary', controller.getSummary)
router.post('/:propertyId', controller.saveProperty)
router.delete('/:propertyId', controller.unsaveProperty)

export default router
