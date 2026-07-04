import { Router } from 'express'
import * as ctrl from './places.controller.js'

const router = Router()

// Public — proxies Google Places/Geocoding for mobile (see places.service.js
// for why mobile can't call Google directly with the web-restricted key)
router.get('/autocomplete',       ctrl.autocomplete)     // GET /api/v1/places/autocomplete?input=...&lat=...&lng=...
router.get('/geocode',            ctrl.geocode)          // GET /api/v1/places/geocode?address=...
router.get('/area-intelligence',  ctrl.areaIntelligence)  // GET /api/v1/places/area-intelligence?lat=...&lng=... — live transit/essentials/IT/traffic for any point
router.get('/commute',            ctrl.commute)           // GET /api/v1/places/commute?lat=...&lng=...&destination=... — live Distance Matrix to a tenant-supplied address

export default router
