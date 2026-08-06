// Locality landing pages — /rent/:city/:area.
//
// The search intent in Indian rentals is "2bhk in anna nagar", not "rentals in
// India". A page per locality is the shape that intent lands on, and the data
// for it already exists: listings carry `landmark`, and the spatial layer
// already describes the cell.
//
// THE RULE THAT MATTERS: a locality page exists only where there are listings
// to show. With ~5 real listings in production, generating a page per known
// area name would produce hundreds of near-empty pages — textbook thin content,
// which is actively penalised and would waste the crawl budget of a small site
// on nothing. `listLocalities()` is derived from live inventory, so the page
// set grows with supply instead of pretending to.
import { prisma } from '../../lib/prisma.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'

/** "Anna Nagar" → "anna-nagar". Reversed by matching against live values, not
 *  by un-slugifying — "t-nagar" could be "T Nagar" or "T. Nagar" and guessing
 *  wrong yields a 404 for a page we do have. */
export const slugify = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

/**
 * Every (city, locality) pair with at least one publicly visible ACTIVE
 * listing. Used by the sitemap and to resolve a slug back to its real name.
 */
export async function listLocalities() {
  const rows = await prisma.property.groupBy({
    by: ['city', 'landmark'],
    where: {
      status: 'ACTIVE',
      // On USER, not Property — see sitemap.service.js.
      owner: { listingVisibility: 'PUBLIC' },
      landmark: { not: null },
      city: { in: SUPPORTED_CITIES },
    },
    _count: { _all: true },
  })

  return rows
    .filter((r) => r.landmark?.trim() && slugify(r.landmark))
    .map((r) => ({
      city: r.city,
      citySlug: slugify(r.city),
      locality: r.landmark.trim(),
      localitySlug: slugify(r.landmark),
      count: r._count._all,
    }))
    // Biggest first — it is the order the sitemap and any future index page
    // both want, and it costs nothing here.
    .sort((a, b) => b.count - a.count)
}

/**
 * One locality page's data. Returns null when the pair has no live listings,
 * which the route turns into a 404 rather than an empty page — see the rule at
 * the top of this file.
 */
export async function getLocality(citySlug, localitySlug) {
  const all = await listLocalities()
  const match = all.find((l) => l.citySlug === citySlug && l.localitySlug === localitySlug)
  if (!match) return null

  const properties = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      owner: { listingVisibility: 'PUBLIC' },
      city: match.city,
      landmark: match.locality,
    },
    select: {
      id: true, title: true, type: true, bhk: true, rent: true, deposit: true,
      pricingModel: true, nightlyRate: true, furnished: true, area: true,
      city: true, landmark: true, updatedAt: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  })

  const rents = properties.map((p) => Number(p.rent)).filter((n) => Number.isFinite(n) && n > 0)

  return {
    ...match,
    properties,
    // A median, not an average: one ₹4Cr plot in a street of ₹15k flats makes
    // an average meaningless, and this number is the page's headline fact.
    medianRent: rents.length ? median(rents) : null,
    types: [...new Set(properties.map((p) => p.type))],
  }
}

function median(sorted) {
  const xs = [...sorted].sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2)
}

/**
 * Is this listing one an anonymous visitor can open? The same rule the sitemap
 * advertises, in one place so the two cannot disagree — a sitemap URL that
 * 404s is worse than no URL at all.
 */
export async function isPubliclyListed(id) {
  const row = await prisma.property.findFirst({
    where: { id, status: 'ACTIVE', owner: { listingVisibility: 'PUBLIC' } },
    select: { id: true },
  })
  return Boolean(row)
}
