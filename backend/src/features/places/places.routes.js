import { Router } from 'express'
import { placesLimiter, placesIntelLimiter } from '../../middlewares/rateLimit.middleware.js'
import * as ctrl from './places.controller.js'

const router = Router()

// Public — proxies Google Places/Geocoding for mobile (see places.service.js
// for why mobile can't call Google directly with the web-restricted key).
// Every route here spends real money, so each is rate-limited by how much it
// costs — see the two buckets in rateLimit.middleware.js.
router.get('/autocomplete',       placesLimiter,      ctrl.autocomplete)     // GET /api/v1/places/autocomplete?input=...&lat=...&lng=...
router.get('/geocode',            placesLimiter,      ctrl.geocode)          // GET /api/v1/places/geocode?address=...
router.get('/area-intelligence',  placesIntelLimiter, ctrl.areaIntelligence)  // GET /api/v1/places/area-intelligence?lat=...&lng=... — live transit/essentials/IT/traffic for any point
router.get('/commute',            placesIntelLimiter, ctrl.commute)           // GET /api/v1/places/commute?lat=...&lng=...&destination=... — live Distance Matrix to a tenant-supplied address

export default router
