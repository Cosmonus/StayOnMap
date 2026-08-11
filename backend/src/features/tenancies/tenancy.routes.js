import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { addTenancyReviewSchema, listTenanciesQuerySchema } from './tenancy.validation.js'
import * as controller from './tenancy.controller.js'

const router = Router()

router.use(authMiddleware) // a tenancy is always somebody's

router.get('/mine', validate(listTenanciesQuerySchema, 'query'), controller.mine)
router.post('/:id/confirm', controller.confirm)
router.post('/:id/decline', controller.decline)
router.post('/:id/reviews', validate(addTenancyReviewSchema), controller.addReview)
// The rental résumé — authorisation is a QUERY inside the service (a contact
// must exist between the caller and this person), and its failure is 404.
router.get('/resume/:userId', controller.resume)

export default router
