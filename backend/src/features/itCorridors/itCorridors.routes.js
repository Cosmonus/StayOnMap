import { Router } from 'express'
import * as ctrl from './itCorridors.controller.js'

const router = Router()

router.get('/', ctrl.getCorridors) // GET /api/v1/it-corridors?city=Chennai — GeoJSON FeatureCollection

export default router
