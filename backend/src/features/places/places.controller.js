import { ok } from '../../utils/response.js'
import * as service from './places.service.js'
import * as intelligence from './areaIntelligence.service.js'

export async function autocomplete(req, res, next) {
  try {
    const { input, lat, lng } = req.query
    const predictions = await service.autocomplete(input, lat, lng)
    ok(res, predictions)
  } catch (err) { next(err) }
}

export async function geocode(req, res, next) {
  try {
    const location = await service.geocode(req.query.address)
    ok(res, location)
  } catch (err) { next(err) }
}

export async function areaIntelligence(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat)
    const lng = parseFloat(req.query.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'lat and lng are required', statusCode: 400 })
    }
    const data = await intelligence.computeAreaIntelligence(lat, lng)
    ok(res, data)
  } catch (err) { next(err) }
}
