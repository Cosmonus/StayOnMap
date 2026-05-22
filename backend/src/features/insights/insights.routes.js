import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createInsightSchema } from './insights.validation.js'
import * as ctrl from './insights.controller.js'

export const propertyInsightRouter = Router({ mergeParams: true })
propertyInsightRouter.get('/', ctrl.list)
propertyInsightRouter.post('/', authMiddleware, validate(createInsightSchema), ctrl.add)
