import { Router } from 'express'
import { buildSitemap, buildRobots } from './sitemap.service.js'
import { loadTemplate, renderHead } from './prerender.service.js'
import { metaForProperty } from './listingMeta.js'
import { metaForLocality } from './localityMeta.js'
import { getLocality, isPubliclyListed } from './locality.service.js'
import { getPropertyById } from '../properties/properties.service.js'
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

// ── Server-rendered <head> for listing and locality pages ───────────────────
//
// nginx proxies /property/:id and /rent/:city/:area here and falls back to the
// plain SPA shell on ANY non-200 (see stayonmap.conf's @spa). So every failure
// path in here — no template on disk, listing not found, database down — is
// answered with a status code rather than a broken page, and the visitor gets
// exactly what they get today.
//
// Cache-Control is short, not the sitemap's hour: this IS the page, and a
// listing that goes off-market must not keep serving a stale price to a
// crawler for an hour.
const HTML_CACHE = 'public, max-age=60'

async function sendWithHead(res, meta) {
  const template = await loadTemplate()
  if (!template) return false
  res.type('html').set('Cache-Control', HTML_CACHE).send(renderHead(template, meta))
  return true
}

router.get('/property/:id', async (req, res, next) => {
  try {
    // Gate FIRST, on a cheap indexed lookup, before the heavy full-payload
    // fetch. Only listings a stranger can actually open get described:
    // advertising a DRAFT or a hidden one to a crawler promises a URL that
    // will not serve it. `listingVisibility` is the OWNER's account setting,
    // not a column on Property — nesting it under `owner` is what makes this
    // a filter rather than a Prisma validation error.
    //
    // A 404 here is cheap and correct: nginx falls back to the plain SPA
    // shell, so a crawler still gets the page the app would have rendered.
    if (!(await isPubliclyListed(req.params.id))) return res.status(404).end()

    // No userId, so this is the public payload — `applyLocationPrivacy` has
    // already removed the street address and coarsened the coordinates if the
    // owner asked for that.
    const property = await getPropertyById(req.params.id)
    if (!property) return res.status(404).end()

    if (!(await sendWithHead(res, metaForProperty(property)))) res.status(404).end()
  } catch (err) { next(err) }
})

router.get('/rent/:citySlug/:localitySlug', async (req, res, next) => {
  try {
    const locality = await getLocality(req.params.citySlug, req.params.localitySlug)
    if (!locality) return res.status(404).end()
    if (!(await sendWithHead(res, metaForLocality(locality)))) res.status(404).end()
  } catch (err) { next(err) }
})

export default router
