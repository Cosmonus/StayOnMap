import { prisma } from '../../lib/prisma.js'
import { listLocalities } from './locality.service.js'
import { listCities } from './city.service.js'
import { allSlugs } from '../blog/blog.service.js'

// The sitemap, generated from live data.
//
// It was a static file in frontend/public with **zero `/property/` URLs**, so
// the only channel that scales in Indian rentals could not see a single listing
// — the inventory was invisible to search by construction, not by ranking.
//
// Always `www`: the apex 302s and DROPS THE PATH (see .claude/roadmap.md P5),
// so an apex URL in a sitemap is a redirect to the homepage, which reads to a
// crawler as every listing being a duplicate of `/`.
const ORIGIN = 'https://www.stayonmap.com'

// Sitemaps cap at 50,000 URLs / 50MB uncompressed. Nowhere near it, but a cap
// that exists only in a comment is not a cap.
const MAX_URLS = 45_000

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
))

// Static routes, with the honest reasons for their frequencies. `/properties`
// is hourly because it genuinely changes with inventory; the marketing pages
// are monthly because they do not.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/properties', changefreq: 'hourly', priority: '0.9' },
  { path: '/intelligence', changefreq: 'monthly', priority: '0.6' },
  { path: '/services', changefreq: 'monthly', priority: '0.5' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.4' },
  { path: '/rules', changefreq: 'monthly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
]

function urlTag({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n')
}

const isoDate = (d) => new Date(d).toISOString().slice(0, 10)

/**
 * Every URL a crawler should know about: the static routes, one per live
 * listing, and one locality page per city that actually has listings.
 *
 * Only ACTIVE listings with PUBLIC visibility. A listing an anonymous visitor
 * cannot open must not be advertised — a sitemap full of URLs that redirect or
 * 404 is worse than a smaller honest one, and `listingVisibility` is the
 * owner's own choice.
 */
export async function buildSitemap() {
  const properties = await prisma.property.findMany({
    // `listingVisibility` lives on USER, not Property — it is the owner's
    // account setting. Filtering it directly on Property (as this did until
    // 2026-08-07) is not a no-op: Prisma validates the shape and THROWS, so
    // the whole sitemap route 500'd. properties.service.js had it right all
    // along; this was a copy that dropped the nesting.
    where: { status: 'ACTIVE', owner: { listingVisibility: 'PUBLIC' } },
    select: { id: true, updatedAt: true, city: true },
    orderBy: { updatedAt: 'desc' },
    take: MAX_URLS,
  })

  const urls = STATIC_ROUTES.map((r) => ({ loc: `${ORIGIN}${r.path}`, ...r }))

  for (const p of properties) {
    urls.push({
      loc: `${ORIGIN}/property/${p.id}`,
      lastmod: isoDate(p.updatedAt),
      changefreq: 'weekly',
      // Below the homepage and the grid, above the marketing pages: a listing
      // is the thing worth finding, but any single one is transient.
      priority: '0.8',
    })
  }

  // Still counted, deliberately: "how many cities have any stock at all" is the
  // supply number this whole file is downstream of, and it stays in `counts`
  // even though it no longer produces URLs.
  const citiesWithStock = new Set(properties.map((p) => p.city).filter(Boolean))

  // City pages — `/rent/chennai`. These REPLACED five `/properties?city=X` URLs
  // on 2026-08-08. The intent behind those was right, a city with stock deserves
  // an entry point, but a query parameter cannot be one: Google reads
  // `?city=Chennai` as a variant of `/properties`, which serves the same SPA
  // shell whatever the query says, so the five were near-duplicates competing
  // with their own parent.
  //
  // `indexable` only, same discipline as the localities below — a city under
  // MIN_CITY_LISTINGS renders and links onward but is not offered for ranking.
  const cities = (await listCities()).filter((c) => c.indexable)
  for (const c of cities) {
    urls.push({
      loc: `${ORIGIN}/rent/${c.citySlug}`,
      changefreq: 'daily',
      // Above a locality page and below the homepage: a city is the broadest
      // real query we can answer ("flats for rent in Chennai"), and its
      // inventory turns over constantly.
      priority: '0.9',
    })
  }

  // Locality pages, gated twice. Derived from live inventory rather than from a
  // list of known area names, so an area with nothing in it gets no URL — with
  // 13 listings, a page per known area name would be hundreds of near-empty
  // pages. Then filtered to `indexable`: a page keyed on the owner's free-text
  // landmark is somebody's typing turned into a URL, and both gates exist to
  // keep a small site's crawl budget on pages that can actually rank. See
  // locality.service.js's isIndexable(). A withheld page still resolves for
  // anyone holding the link; it is simply not advertised here.
  const localities = (await listLocalities()).filter((l) => l.indexable)
  for (const l of localities) {
    urls.push({
      loc: `${ORIGIN}/rent/${l.citySlug}/${l.localitySlug}`,
      changefreq: 'daily',
      // Above a single listing: a locality page stays useful as its listings
      // turn over, which is exactly what a crawler should prefer to re-visit.
      priority: '0.85',
    })
  }

  // Articles. Unlike everything above, these do not depend on inventory — they
  // are the one part of the sitemap that is worth crawling on day one, when
  // there are five listings and nothing else here says anything a stranger
  // was searching for. `lastmod` is the post's own updatedAt, so a corrected
  // article invites a re-crawl and an untouched one does not.
  const posts = allSlugs()
  if (posts.length) {
    urls.push({ loc: `${ORIGIN}/blog`, changefreq: 'weekly', priority: '0.7' })
  }
  for (const p of posts) {
    urls.push({
      loc: `${ORIGIN}/blog/${p.slug}`,
      lastmod: isoDate(p.updatedAt),
      // Articles change rarely but stay relevant, which is the opposite of a
      // listing: low changefreq, high priority.
      changefreq: 'monthly',
      priority: '0.8',
    })
  }

  const body = urls.map(urlTag).join('\n')
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    counts: {
      total: urls.length,
      properties: properties.length,
      cities: citiesWithStock.size,
      cityPages: cities.length,
      localities: localities.length,
      posts: posts.length,
    },
  }
}

/**
 * robots.txt, served from the same place so the sitemap URL cannot drift from
 * the route that actually serves it — they were two files before and only one
 * of them knew the truth.
 */
export function buildRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    // Nothing here is secret — these are simply pages a crawler gains nothing
    // from and that would burn crawl budget on a small site.
    'Disallow: /user',
    'Disallow: /admin',
    'Disallow: /list',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /oauth-complete',
    '',
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    '',
  ].join('\n')
}
