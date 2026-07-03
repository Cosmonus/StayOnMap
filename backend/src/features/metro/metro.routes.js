import { Router } from 'express'
import * as ctrl from './metro.controller.js'

const router = Router()

router.get('/', ctrl.getNetwork) // GET /api/v1/metro?city=Bengaluru — { city, lines, stations } | null

export default router
