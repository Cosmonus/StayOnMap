/**
 * Server-rendered <head> + locality pages — 2026-08-07.
 *
 * The gap this closes: every listing served the same generic `<title>`, so a
 * crawler saw one page repeated N times, and every listing shared on WhatsApp
 * — the dominant sharing channel in Indian rentals — previewed as "StayOnMap —
 * Rent with intelligence." with the default image. Link-preview bots never
 * execute JS, so `SEOMeta` running client-side could not reach them at all.
 *
 * The properties worth pinning:
 *   1. Injected tags REPLACE the template's own. Two <title>s in one document
 *      means the winner is a coin flip per consumer.
 *   2. Titles and structured data are per-TYPE. "Land for rent — ₹45,00,000/mo"
 *      is the kind of sentence that ends trust, and a generic template
 *      produces exactly that.
 *   3. No street address ever reaches structured data.
 *   4. A locality page exists only where there is inventory to show.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prismaMock } from './mocks/prisma.js'
import { renderHead, SHELL_CSP } from '../src/features/seo/prerender.service.js'
import { titleFor, descriptionFor, jsonLdFor, metaForProperty } from '../src/features/seo/listingMeta.js'
import { slugify, listLocalities, getLocality } from '../src/features/seo/locality.service.js'
import { metaForLocality } from '../src/features/seo/localityMeta.js'

const TEMPLATE = `<!doctype html><html><head>
  <title>StayOnMap — Rent with intelligence.</title>
  <meta name="description" content="default blurb" />
  <meta property="og:title" content="StayOnMap — Rent with intelligence." />
  <meta property="og:image" content="https://www.stayonmap.com/og-default.jpg" />
  <link rel="canonical" href="https://www.stayonmap.com" />
</head><body><div id="root"></div></body></html>`

const flat = (over = {}) => ({
  id: 'p1',
  title: 'Sunny 2BHK near the park',
  type: 'APARTMENT',
  status: 'ACTIVE',
  bhk: 2,
  bathrooms: 2,
  rent: 28000,
  deposit: 100000,
  area: 950,
  furnished: 'SEMI',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600040',
  landmark: 'Anna Nagar',
  address: '12/4 Second Street',
  images: [{ url: 'https://cdn/img1.jpg', isPrimary: true }, { url: 'https://cdn/img2.jpg' }],
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('head injection', () => {
  it('replaces the template tags rather than appending a second set', () => {
    const html = renderHead(TEMPLATE, {
      title: 'Real title', description: 'Real description',
      canonical: 'https://www.stayonmap.com/property/p1',
    })

    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html).toContain('<title>Real title</title>')
    expect(html).not.toContain('Rent with intelligence')
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  })

  it('leaves the app shell intact — this is a head injection, not a rewrite', () => {
    const html = renderHead(TEMPLATE, { title: 'T', description: 'D', canonical: 'C' })
    expect(html).toContain('<div id="root"></div>')
  })

  it('escapes user-controlled text so a listing title cannot inject markup', () => {
    const html = renderHead(TEMPLATE, {
      title: 'Flat "quoted" <script>alert(1)</script>',
      description: 'D', canonical: 'C',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('neutralises </script> inside JSON-LD, which HTML escaping would not', () => {
    // The real hazard in a JSON-LD block: a closing tag inside a STRING ends
    // the script element early and everything after it becomes page markup.
    const html = renderHead(TEMPLATE, {
      title: 'T', description: 'D', canonical: 'C',
      jsonLd: { name: 'evil </script><img src=x onerror=alert(1)>' },
    })
    expect(html).not.toContain('</script><img')
    expect(html).toContain('\\u003c/script')
  })

  it('emits noindex only when asked', () => {
    const plain = renderHead(TEMPLATE, { title: 'T', description: 'D', canonical: 'C' })
    expect(plain).not.toContain('noindex')
    const hidden = renderHead(TEMPLATE, { title: 'T', description: 'D', canonical: 'C', noindex: true })
    expect(hidden).toContain('content="noindex,follow"')
  })
})

/**
 * Found live on 2026-08-07: /property/:id is the ONE page type served through
 * Express, so it alone carried `helmet()`'s default `script-src 'self';
 * img-src 'self' data:` — which blocked the Google Maps SDK, every Supabase
 * photo and the Google Analytics tag on the page most often shared, while the
 * byte-identical shell at `/` (nginx, no CSP) loaded all three.
 *
 * The trap is that this looks like debt worth tidying. Tightening these two
 * directives does not fail a test, does not fail a deploy, and breaks the
 * property page silently — so the intent is pinned here instead.
 */
describe('the served shell is not stricter than the static one', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const shell = readFileSync(path.resolve(here, '../../frontend/index.html'), 'utf8')

  it('permits every third-party origin the shell actually loads', () => {
    const origins = [...shell.matchAll(/(?:src|href)="(https:\/\/[^/"]+)/g)].map((m) => m[1])
    // Google Maps, Fonts and now googletagmanager — if the shell gains another,
    // this still holds, because the policy names no host to keep in sync.
    expect(origins.length).toBeGreaterThan(0)
    expect(SHELL_CSP).not.toMatch(/script-src|img-src|connect-src|style-src|font-src/)
    expect(SHELL_CSP).toMatch(/default-src \*/)
  })

  it('still refuses plugins, injected <base> and framing — those cost nothing', () => {
    expect(SHELL_CSP).toContain("object-src 'none'")
    expect(SHELL_CSP).toContain("base-uri 'self'")
    expect(SHELL_CSP).toContain("frame-ancestors 'self'")
  })

  it('carries the analytics tag in the shell, so every route reports', () => {
    // renderHead only strips title/description/og/twitter/canonical, so a tag in
    // the template survives into the server-rendered pages for free.
    expect(shell).toContain('googletagmanager.com/gtag/js')
    expect(renderHead(shell, { title: 'T', description: 'D', canonical: 'C' }))
      .toContain('googletagmanager.com/gtag/js')
  })
})

describe('titles are per property type', () => {
  it('describes a flat by its BHK and monthly rent', () => {
    expect(titleFor(flat())).toBe(
      '2 BHK apartment for rent in Anna Nagar, Chennai — ₹28,000/mo | StayOnMap'
    )
  })

  it('never puts /mo on a plot for sale', () => {
    // The failure this guards: "Land for rent in Chennai — ₹45,00,000/mo".
    const title = titleFor(flat({
      type: 'LAND', bhk: null, pricingModel: 'SALE', rent: 4500000,
      extent: 1200, extentUnit: 'sq.ft',
    }))
    expect(title).toContain('1200 sq.ft plot for sale')
    expect(title).not.toContain('/mo')
  })

  it('prices a short stay per night, not per month', () => {
    const title = titleFor(flat({ type: 'SHORT_STAY', bhk: null, maxGuests: 4, nightlyRate: 2500 }))
    expect(title).toContain('/night')
    expect(title).toContain('Sleeps 4')
  })

  it('prices a lease as a lump sum, never monthly', () => {
    expect(titleFor(flat({ pricingModel: 'LEASE', rent: 1500000 }))).toContain('₹15,00,000 lease')
  })

  it('describes a PG by its sharing, not by bedrooms it does not have', () => {
    const title = titleFor(flat({ type: 'PG', bhk: null, sharing: 3 }))
    expect(title).toContain('3-sharing pg')
    expect(title).not.toContain('BHK')
  })

  it('describes a shop by carpet area', () => {
    expect(titleFor(flat({ type: 'COMMERCIAL', bhk: null, carpetArea: 400 })))
      .toContain('400 sq.ft commercial space for rent')
  })
})

describe('descriptions state facts, not the owner’s prose', () => {
  it('carries the spec, the price and the brokerage promise', () => {
    const d = descriptionFor(flat())
    expect(d).toContain('2 BHK')
    expect(d).toContain('₹28,000/mo')
    expect(d).toContain('No brokerage')
  })

  it('stays inside a search snippet', () => {
    expect(descriptionFor(flat()).length).toBeLessThanOrEqual(300)
  })
})

describe('structured data', () => {
  it('drops the street address when the owner coarsened their pin', () => {
    // `applyLocationPrivacy` nulls `address` upstream, so the absence of the
    // field IS the owner's choice — structured data must not reintroduce it,
    // and must not publish an EMPTY streetAddress either.
    const ld = jsonLdFor(flat({ address: null }))
    expect(ld.about.address.streetAddress).toBeUndefined()
    expect('streetAddress' in ld.about.address).toBe(false)
    expect(ld.about.address.addressLocality).toBe('Anna Nagar')
  })

  it('mirrors the page when the owner does share it', () => {
    expect(jsonLdFor(flat()).about.address.streetAddress).toBe('12/4 Second Street')
  })

  it('types a home as a residence and a plot as a place', () => {
    expect(jsonLdFor(flat()).about['@type']).toBe('Apartment')
    expect(jsonLdFor(flat({ type: 'LAND', bhk: null })).about['@type']).toBe('Place')
  })

  it('omits bedrooms for types that have none, rather than claiming zero', () => {
    const land = jsonLdFor(flat({ type: 'LAND', bhk: null }))
    expect(land.about.numberOfBedroomsTotal).toBeUndefined()
    expect(jsonLdFor(flat()).about.numberOfBedroomsTotal).toBe(2)
  })

  it('marks a plot for sale as Sell and everything else as LeaseOut', () => {
    expect(jsonLdFor(flat({ type: 'LAND', pricingModel: 'SALE' })).offers.businessFunction)
      .toContain('#Sell')
    expect(jsonLdFor(flat()).offers.businessFunction).toContain('#LeaseOut')
  })

  it('offers the nightly rate for a short stay, not the monthly one', () => {
    expect(jsonLdFor(flat({ type: 'SHORT_STAY', nightlyRate: 2500 })).offers.price).toBe(2500)
  })

  it('uses the primary image for the link preview', () => {
    expect(metaForProperty(flat()).image).toBe('https://cdn/img1.jpg')
  })
})

describe('locality pages exist only where there is inventory', () => {
  it('derives the page set from live listings, not from a list of area names', async () => {
    prismaMock.property.groupBy.mockResolvedValue([
      { city: 'Chennai', landmark: 'Anna Nagar', _count: { _all: 3 } },
      { city: 'Chennai', landmark: 'T. Nagar', _count: { _all: 1 } },
    ])

    const all = await listLocalities()
    expect(all.map((l) => l.localitySlug)).toEqual(['anna-nagar', 't-nagar'])
    // Biggest first.
    expect(all[0].count).toBe(3)
  })

  it('404s a locality with nothing in it rather than serving an empty page', async () => {
    prismaMock.property.groupBy.mockResolvedValue([])
    expect(await getLocality('chennai', 'anna-nagar')).toBeNull()
  })

  it('asks only for listings a stranger can open', async () => {
    prismaMock.property.groupBy.mockResolvedValue([])
    await listLocalities()
    const { where } = prismaMock.property.groupBy.mock.calls[0][0]
    // Nested under `owner` — see the sitemap test for why this exact shape is
    // the assertion that matters.
    expect(where.owner).toEqual({ listingVisibility: 'PUBLIC' })
  })

  it('reports the MEDIAN rent, so one ₹4Cr plot cannot define a street', async () => {
    prismaMock.property.groupBy.mockResolvedValue([
      { city: 'Chennai', landmark: 'Anna Nagar', _count: { _all: 4 } },
    ])
    prismaMock.property.findMany.mockResolvedValue([
      { id: 'a', rent: 15000, type: 'APARTMENT', images: [] },
      { id: 'b', rent: 18000, type: 'APARTMENT', images: [] },
      { id: 'c', rent: 20000, type: 'APARTMENT', images: [] },
      { id: 'd', rent: 40000000, type: 'LAND', images: [] },
    ])

    const locality = await getLocality('chennai', 'anna-nagar')
    expect(locality.medianRent).toBe(19000) // (18000 + 20000) / 2
  })

  it('titles the page with the count and the city', async () => {
    const meta = metaForLocality({
      city: 'Chennai', citySlug: 'chennai',
      locality: 'Anna Nagar', localitySlug: 'anna-nagar',
      count: 3, medianRent: 19000, properties: [{ id: 'a', title: 'Flat' }],
    })
    expect(meta.title).toContain('Rent in Anna Nagar, Chennai — 3 homes')
    expect(meta.canonical).toBe('https://www.stayonmap.com/rent/chennai/anna-nagar')
    expect(meta.jsonLd.mainEntity['@type']).toBe('ItemList')
  })

  it('slugifies the way a URL needs and nothing more', () => {
    expect(slugify('T. Nagar')).toBe('t-nagar')
    expect(slugify('  Anna   Nagar  ')).toBe('anna-nagar')
    expect(slugify('')).toBe('')
  })
})

/**
 * The class of bug that shipped in the sitemap and survived a full test suite:
 * a `where` key that is not a field on the model. Prisma validates and THROWS,
 * but every test mocks Prisma, so a mock happily records the wrong shape and
 * reports green. This reads the real schema instead.
 */
describe('query shapes match the real Prisma schema', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const schema = readFileSync(path.resolve(here, '../prisma/schema.prisma'), 'utf8')

  function fieldsOf(model) {
    const body = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)[1]
    return new Set(
      body.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
        .map((l) => l.split(/\s+/)[0])
    )
  }

  const OPERATORS = new Set(['AND', 'OR', 'NOT'])

  it('every key the SEO queries filter Property on is a real Property field', async () => {
    const propertyFields = fieldsOf('Property')

    prismaMock.property.groupBy.mockResolvedValue([])
    prismaMock.property.findMany.mockResolvedValue([])
    const { buildSitemap } = await import('../src/features/seo/sitemap.service.js')
    await buildSitemap()
    await listLocalities()

    const wheres = [
      ...prismaMock.property.findMany.mock.calls.map((c) => c[0].where),
      ...prismaMock.property.groupBy.mock.calls.map((c) => c[0].where),
    ].filter(Boolean)

    expect(wheres.length).toBeGreaterThan(0)
    for (const where of wheres) {
      for (const key of Object.keys(where)) {
        if (OPERATORS.has(key)) continue
        expect(propertyFields, `"${key}" is not a field on Property`).toContain(key)
      }
    }
  })

  it('proves the guard works: listingVisibility is on User, not Property', () => {
    // The exact mistake, stated as a fact so the guard above cannot be
    // "corrected" into passing by adding the field to the allowed set.
    expect(fieldsOf('User')).toContain('listingVisibility')
    expect(fieldsOf('Property')).not.toContain('listingVisibility')
  })
})
