import { ok } from '../../utils/response.js'
import { pincodeInfo } from '../spatial/pincodeProvider.js'
import { isWithinIndia } from '../../utils/geo.js'
import * as service from './places.service.js'
import * as intelligence from './areaIntelligence.service.js'

// Each uncached area-intelligence call bills ~11 Google requests, and the cache
// keys on the caller's own coordinates — so an out-of-range point is a
// guaranteed cache miss on a paid API. Reject anything outside India.
function badCoords(res) {
  return res.status(400).json({
    success: false, error: 'VALIDATION_ERROR',
    message: 'lat and lng are required and must be within India', statusCode: 400,
  })
}

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
    if (!isWithinIndia(lat, lng)) return badCoords(res)
    const data = await intelligence.computeAreaIntelligence(lat, lng)
    ok(res, data)
  } catch (err) { next(err) }
}

export async function commute(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat)
    const lng = parseFloat(req.query.lng)
    const destination = req.query.destination
    if (!isWithinIndia(lat, lng) || !destination?.trim()) return badCoords(res)
    const data = await intelligence.computeCommute(lat, lng, destination)
    ok(res, data)
  } catch (err) { next(err) }
}

// What India Post says a pincode is — for the listing wizard, so an owner sees
// "560095 - Koramangala VI Bk, Bengaluru, KARNATAKA" the moment they type it,
// and a typo is caught BEFORE publish instead of by a moderator after.
// Free: reads the locally-seeded directory, no external call.
export async function pincode(req, res, next) {
  try {
    const code = String(req.params.code ?? '').trim()
    if (!/^d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'BAD_PINCODE', message: 'A pincode is six digits' })
    }
    const info = await pincodeInfo(code)
    // available:false = directory not seeded — say so rather than implying the
    // pincode is unknown. The wizard treats it as "no data", never as a warning.
    ok(res, info)
  } catch (err) { next(err) }
}
