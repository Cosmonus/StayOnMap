// The city landing page — `/rent/chennai`.
//
// This is the page that replaces the five `/properties?city=X` URLs the sitemap
// used to carry (removed 2026-08-08). The intent behind those was right — a city
// with stock deserves an entry point — but a query parameter cannot be one:
// Google reads `?city=Chennai` as a variant of `/properties`, and `/properties`
// serves the same shell whatever the query says.
//
// It reuses the SAME inventory query the locality pages and the sitemap read.
// There is deliberately no second property-search path here: the rule from the
// SEO brief that matters most on a codebase this size is "do not create a second
// property search system".
import { prisma } from '../../lib/prisma.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { listLocalities, slugify } from './locality.service.js'

/**
 * How many listings a city page needs before it is worth asking Google to rank.
 *
 * A city page's value is showing a CHOICE. One listing is not a choice — it is a
 * listing, and `/property/:id` already serves that person better with more
 * detail and a real photo. Three is the smallest number that reads as a
 * selection rather than an accident.
 *
 * This is a threshold on QUANTITY, unlike the locality gate next door, which is
 * on the quality of the key. The difference is deliberate: a city is always a
 * real, searchable place — "flats for rent in Chennai" is a query whatever our
 * inventory looks like — so the only question is whether we have enough to say.
 * A locality slugified out of `Property.landmark` is not a place at all, and no
 * amount of volume fixes that.
 */
export const MIN_CITY_LISTINGS = 3

/** Every supported city that currently has publicly visible ACTIVE stock. */
export async function listCities() {
  const rows = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      // On USER, not Property — the owner's account setting. See sitemap.service.js.
      owner: { listingVisibility: 'PUBLIC' },
      city: { in: SUPPORTED_CITIES },
    },
    select: { city: true },
  })

  const counts = new Map()
  for (const r of rows) {
    if (!r.city) continue
    counts.set(r.city, (counts.get(r.city) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([city, count]) => ({
      city,
      citySlug: slugify(city),
      count,
      indexable: count >= MIN_CITY_LISTINGS,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * One city page's data, or null when the city has nothing in it.
 *
 * Null becomes a 404 rather than an empty page — the same rule the locality
 * pages follow. A page about no homes is worse than no page: it teaches a
 * crawler that this URL shape is empty.
 */
export async function getCity(citySlug) {
  const cities = await listCities()
  const match = cities.find((c) => c.citySlug === citySlug)
  if (!match) return null

  const properties = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      owner: { listingVisibility: 'PUBLIC' },
      city: match.city,
    },
    select: {
      id: true, title: true, type: true, bhk: true, rent: true,
      pricingModel: true, landmark: true, city: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 24,
  })

  // The areas within this city that have their own page. Only indexable ones:
  // this list is the city page's internal linking, and linking to a page we have
  // asked Google not to index spends the city page's authority on a dead end.
  const localities = (await listLocalities())
    .filter((l) => l.citySlug === citySlug && l.indexable)
    .map(({ locality, localitySlug, count }) => ({ locality, localitySlug, count }))

  const rents = properties
    .map((p) => Number(p.rent))
    .filter((n) => Number.isFinite(n) && n > 0)

  return {
    ...match,
    properties,
    localities,
    // A median, not an average — one ₹4Cr plot among ₹15k flats makes an
    // average meaningless, and this is the page's headline number.
    medianRent: rents.length ? median(rents) : null,
    types: [...new Set(properties.map((p) => p.type))],
  }
}

function median(values) {
  const xs = [...values].sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2)
}
