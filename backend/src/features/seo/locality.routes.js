import { Router } from 'express'
import { getLocality } from './locality.service.js'
import { ok, notFound } from '../../utils/response.js'

const router = Router({ mergeParams: true })

// The JSON the locality page's React component fetches once it hydrates. The
// same data the server used to build that page's <head>, so the two can never
// describe different inventory.
//
// Public and unauthenticated: this is a landing page for people who have not
// signed up yet, which is the entire point of it existing.
router.get('/:citySlug/:localitySlug', async (req, res, next) => {
  try {
    const locality = await getLocality(req.params.citySlug, req.params.localitySlug)
    if (!locality) return notFound(res)
    ok(res, locality)
  } catch (err) { next(err) }
})

export default router
