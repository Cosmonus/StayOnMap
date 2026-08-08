import { Router } from 'express'
import { buildSitemap, buildRobots } from './sitemap.service.js'
import { loadTemplate, renderHead, SHELL_CSP } from './prerender.service.js'
import { metaForProperty } from './listingMeta.js'
import { metaForLocality } from './localityMeta.js'
import { metaForPost, metaForBlogIndex } from './blogMeta.js'
import { getLocality, isPubliclyListed } from './locality.service.js'
import { getCity } from './city.service.js'
import { metaForCity } from './cityMeta.js'
import { listPosts, getPost } from '../blog/blog.service.js'
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

// Overrides helmet()'s default policy on the shell only — see SHELL_CSP.
const shellHeaders = (res, cache) =>
  res.type('html').set('Cache-Control', cache).set('Content-Security-Policy', SHELL_CSP)

async function sendWithHead(res, meta, cache = HTML_CACHE) {
  const template = await loadTemplate()
  if (!template) return false
  shellHeaders(res, cache).send(renderHead(template, meta))
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

// Registered BEFORE the two-segment locality route below. Express matches on
// segment count so the order is not strictly required here — it is written this
// way so the hierarchy reads top-down, city then area, the way the URLs nest.
router.get('/rent/:citySlug', async (req, res, next) => {
  try {
    const city = await getCity(req.params.citySlug)
    if (!city) return res.status(404).end()
    if (!(await sendWithHead(res, metaForCity(city)))) res.status(404).end()
  } catch (err) { next(err) }
})

router.get('/rent/:citySlug/:localitySlug', async (req, res, next) => {
  try {
    const locality = await getLocality(req.params.citySlug, req.params.localitySlug)
    if (!locality) return res.status(404).end()
    if (!(await sendWithHead(res, metaForLocality(locality)))) res.status(404).end()
  } catch (err) { next(err) }
})

// ── Blog ────────────────────────────────────────────────────────────────────
//
// The one surface here whose whole reason for existing is to be found. A
// listing page is shared; an article is SEARCHED, and a search result is built
// from the <title> and description in the first response. Posts are served
// from memory (see features/blog/blog.service.js), so these two routes cost a
// map lookup and a string replace.
//
// Cache-Control is longer than a listing's 60s: an article does not go off
// market, and its facts do not change between a crawl and a click.
const BLOG_CACHE = 'public, max-age=600'

router.get('/blog', async (req, res, next) => {
  try {
    if (!(await sendWithHead(res, metaForBlogIndex(listPosts()), BLOG_CACHE))) res.status(404).end()
  } catch (err) { next(err) }
})

router.get('/blog/:slug', async (req, res, next) => {
  try {
    const post = getPost(req.params.slug)
    // Unknown slug → 404 → nginx @spa → the SPA renders its own not-found.
    // Never a server-rendered head describing an article that does not exist.
    if (!post) return res.status(404).end()
    if (!(await sendWithHead(res, metaForPost(post), BLOG_CACHE))) res.status(404).end()
  } catch (err) { next(err) }
})

export default router
