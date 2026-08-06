import { prisma } from '../../lib/prisma.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { listLocalities } from './locality.service.js'

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

  // One city page per city that HAS listings. Listing a city with nothing in it
  // sends a crawler to an empty grid, which is exactly the "beautiful map of
  // nothing" problem in URL form.
  const citiesWithStock = new Set(properties.map((p) => p.city).filter(Boolean))
  for (const city of SUPPORTED_CITIES) {
    if (!citiesWithStock.has(city)) continue
    urls.push({
      loc: `${ORIGIN}/properties?city=${encodeURIComponent(city)}`,
      changefreq: 'daily',
      priority: '0.7',
    })
  }

  // Locality pages, derived from live inventory rather than from a list of
  // known area names. Only areas that HAVE listings get a URL — see
  // locality.service.js: with ~5 listings, a page per known area name would be
  // hundreds of near-empty pages, which is thin content and burns the crawl
  // budget of a small site on nothing.
  const localities = await listLocalities()
  for (const l of localities) {
    urls.push({
      loc: `${ORIGIN}/rent/${l.citySlug}/${l.localitySlug}`,
      changefreq: 'daily',
      // Above a single listing: a locality page stays useful as its listings
      // turn over, which is exactly what a crawler should prefer to re-visit.
      priority: '0.85',
    })
  }

  const body = urls.map(urlTag).join('\n')
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    counts: {
      total: urls.length,
      properties: properties.length,
      cities: citiesWithStock.size,
      localities: localities.length,
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
