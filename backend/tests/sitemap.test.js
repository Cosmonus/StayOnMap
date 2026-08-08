/**
 * The sitemap actually contains the inventory.
 *
 * It was a hand-written static file with **zero `/property/` URLs**. Search is
 * the one channel that scales in Indian rentals, and it could not see a single
 * listing — not because of ranking, but because nothing ever told it they
 * existed. A sitemap that returns 200 with a well-formed but listing-free body
 * looks completely healthy from the outside, which is why this is a test rather
 * than something to eyeball after a deploy.
 *
 * Three things are load-bearing and each fails silently:
 *   1. Listings are IN it. A sitemap of nine marketing pages is the old bug.
 *   2. Only listings a stranger can actually open. Advertising a URL that
 *      redirects or 404s is worse than a smaller honest sitemap.
 *   3. Every URL is `www`. The apex 302s and DROPS THE PATH, so an apex listing
 *      URL resolves to the homepage — which reads to a crawler as every listing
 *      being a duplicate of `/`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { buildSitemap, buildRobots } = await vi.importActual('../src/features/seo/sitemap.service.js')

const listing = (id, over = {}) => ({
  id,
  updatedAt: new Date('2026-08-01T10:00:00Z'),
  city: 'Chennai',
  ...over,
})

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

beforeEach(() => vi.clearAllMocks())

describe('sitemap', () => {
  it('includes a URL for every live listing', async () => {
    prismaMock.property.findMany.mockResolvedValue([listing('abc'), listing('def')])

    const { xml, counts } = await buildSitemap()
    const urls = locs(xml)

    expect(urls).toContain('https://www.stayonmap.com/property/abc')
    expect(urls).toContain('https://www.stayonmap.com/property/def')
    expect(counts.properties).toBe(2)
  })

  // The original bug, stated as an assertion: a sitemap with only static routes
  // is the failure, and it is indistinguishable from a healthy one by eye.
  it('is not just the marketing pages', async () => {
    prismaMock.property.findMany.mockResolvedValue([listing('abc')])
    const { xml } = await buildSitemap()
    expect(locs(xml).filter((u) => u.includes('/property/')).length).toBeGreaterThan(0)
  })

  it('asks the database only for listings a stranger can open', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    await buildSitemap()

    const { where, take } = prismaMock.property.findMany.mock.calls[0][0]
    expect(where.status).toBe('ACTIVE')
    // The owner's own privacy choice. A HIDDEN or LOGGED_IN listing in a public
    // sitemap is us advertising something they asked us not to.
    //
    // ⚠ Nested under `owner`, and this assertion is the whole reason to care:
    // `listingVisibility` is a column on USER, not on Property. The first
    // version of this test asserted `where.listingVisibility` and passed
    // against a MOCK, while the real Prisma client validates the shape and
    // THROWS — so /sitemap.xml 500'd in production for the whole day it
    // shipped. A mock cannot check a schema; only the field's real home can.
    expect(where.owner).toEqual({ listingVisibility: 'PUBLIC' })
    expect(where.listingVisibility).toBeUndefined()
    // Sitemaps cap at 50k URLs; a cap that lives only in a comment is not one.
    expect(take).toBeLessThanOrEqual(45_000)
  })

  it('uses www for every URL, never the apex', async () => {
    prismaMock.property.findMany.mockResolvedValue([listing('abc')])
    const { xml } = await buildSitemap()

    for (const url of locs(xml)) {
      expect(url.startsWith('https://www.stayonmap.com')).toBe(true)
    }
  })

  it('asks a crawler to rank no query-parameter URL', async () => {
    // Replaces "lists a city only when that city has stock" (2026-08-08). That
    // rule was right — never advertise a city with nothing in it — but the URL
    // it produced was `/properties?city=Chennai`, and Google reads that as a
    // variant of `/properties` rather than a page of its own. `/properties`
    // serves the same SPA shell whatever the query says, so the five city URLs
    // were five near-duplicates competing with their own parent.
    //
    // The real replacement is a `/rent/:citySlug` page. Until it exists the
    // sitemap simply does not claim one, and this asserts the general form so
    // the next person cannot reintroduce the shape with a different parameter.
    prismaMock.property.findMany.mockResolvedValue([listing('abc', { city: 'Chennai' })])
    const urls = locs((await buildSitemap()).xml)

    expect(urls.some((u) => u.includes('?'))).toBe(false)
    expect(urls.some((u) => u.includes('city='))).toBe(false)
  })

  it('still counts cities with stock, even though it no longer links them', async () => {
    // The supply number this whole file is downstream of. Dropping the URLs
    // must not quietly drop the measurement with them.
    prismaMock.property.findMany.mockResolvedValue([
      listing('a', { city: 'Chennai' }),
      listing('b', { city: 'Chennai' }),
      listing('c', { city: 'Mumbai' }),
    ])
    const { counts } = await buildSitemap()
    expect(counts.cities).toBe(2)
  })

  it('escapes XML rather than emitting a broken document', async () => {
    prismaMock.property.findMany.mockResolvedValue([listing('a&b<c')])
    const { xml } = await buildSitemap()
    expect(xml).toContain('a&amp;b&lt;c')

    // No BARE `&` or `<` left inside a <loc>. Checked by removing the legal
    // entities first and then looking for the raw characters — a regex that
    // tries to spot "an & not followed by an entity" matches `&amp;` itself
    // (the `a` of `amp;`), which is how the first version of this assertion
    // failed on correctly-escaped output.
    for (const loc of locs(xml)) {
      const withoutEntities = loc.replace(/&(amp|lt|gt|quot|apos);/g, '')
      expect(withoutEntities).not.toMatch(/[<>&]/)
    }
  })

  it('still produces a valid document with no listings at all', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    const { xml } = await buildSitemap()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
    expect(locs(xml).length).toBeGreaterThan(0) // the static routes survive
  })
})

describe('robots.txt', () => {
  it('points at the sitemap that actually exists', () => {
    expect(buildRobots()).toContain('Sitemap: https://www.stayonmap.com/sitemap.xml')
  })

  it('keeps crawlers out of the authenticated surfaces', () => {
    const txt = buildRobots()
    for (const path of ['/user', '/admin', '/list']) {
      expect(txt).toContain(`Disallow: ${path}`)
    }
  })

  it('does not disallow the pages we want found', () => {
    const txt = buildRobots()
    expect(txt).not.toMatch(/Disallow: \/properties/)
    expect(txt).not.toMatch(/Disallow: \/property/)
    expect(txt).toContain('Allow: /')
  })
})
