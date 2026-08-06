import { Router } from 'express'
import { buildSitemap, buildRobots } from './sitemap.service.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'

const router = Router()

// Public and unauthenticated by definition — a crawler has no token.
//
// Cached 1h. A sitemap is read by robots on their own schedule, not by users,
// and regenerating it per request would let a crawler drive a full-table scan
// at whatever rate it liked. `cacheGet`/`cacheSet` no-op without Redis, so a
// fresh checkout still serves a correct (uncached) sitemap.
const TTL_SECONDS = 3600
const CACHE_KEY = 'seo:sitemap'

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cached)
      return
    }
    const { xml, counts } = await buildSitemap()
    await cacheSet(CACHE_KEY, xml, TTL_SECONDS)
    // One line per generation, so "is the inventory actually in the sitemap"
    // is answerable from the logs rather than by fetching and counting.
    // console.log, not intelError — this is a success, and intelError writes an
    // `error` field at error level.
    console.log(JSON.stringify({ src: 'seo', event: 'sitemap_built', ...counts }))
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml)
  } catch (err) { next(err) }
})

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(buildRobots())
})

export default router
