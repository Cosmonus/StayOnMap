import { Router } from 'express'
import * as ctrl from './areas.controller.js'

const router = Router()

router.get('/match',    ctrl.match)   // GET /api/v1/areas/match?city=Chennai&area=OMR
router.get('/',         ctrl.list)
router.get('/:slug',    ctrl.get)

export default router
