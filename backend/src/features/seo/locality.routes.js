import { Router } from 'express'
import { getLocality } from './locality.service.js'
import { getCity } from './city.service.js'
import { ok, notFound } from '../../utils/response.js'

const router = Router({ mergeParams: true })

// The JSON the locality page's React component fetches once it hydrates. The
// same data the server used to build that page's <head>, so the two can never
// describe different inventory.
//
// Public and unauthenticated: this is a landing page for people who have not
// signed up yet, which is the entire point of it existing.
// The city page's data. Same contract as the locality one below: the JSON the
// React page hydrates from IS the data the server built the <head> from, so the
// two can never describe different inventory.
router.get('/:citySlug', async (req, res, next) => {
  try {
    const city = await getCity(req.params.citySlug)
    if (!city) return notFound(res)
    ok(res, city)
  } catch (err) { next(err) }
})

router.get('/:citySlug/:localitySlug', async (req, res, next) => {
  try {
    const locality = await getLocality(req.params.citySlug, req.params.localitySlug)
    if (!locality) return notFound(res)
    ok(res, locality)
  } catch (err) { next(err) }
})

export default router
