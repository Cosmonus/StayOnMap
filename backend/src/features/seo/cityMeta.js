// Title, description and structured data for a city landing page.
//
// Same discipline as localityMeta.js: every number in the title and description
// is measured from live inventory, and nothing is claimed about the city that
// the listings themselves do not say. A city page that describes Chennai rather
// than describing what we have IN Chennai is an article, and a thin one.
import { ORIGIN } from './prerender.service.js'
import { breadcrumbFor } from './localityMeta.js'

const inr = (n) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n))}`

export function cityUrl(city) {
  return `${ORIGIN}/rent/${city.citySlug}`
}

export function metaForCity(city) {
  const { city: name, count, medianRent, localities } = city
  const homes = `${count} ${count === 1 ? 'home' : 'homes'}`

  const title = `Rent in ${name} — ${homes} without brokerage | StayOnMap`

  const description = [
    `${homes} for rent in ${name}, listed directly by owners.`,
    medianRent ? `Median rent ${inr(medianRent)}/mo.` : null,
    // Only mentioned when there are areas with their own pages to mention.
    localities.length ? `Browse ${localities.length} areas.` : null,
    'No brokerage, no agents — see them on the map.',
  ].filter(Boolean).join(' ')

  return {
    title,
    description,
    canonical: cityUrl(city),
    type: 'website',
    // Below MIN_CITY_LISTINGS the page still renders and still links onward —
    // it is simply not offered for ranking. `follow`, because its links to
    // real listings are worth crawling even when the page is too thin to rank.
    noindex: city.indexable === false,
    jsonLd: {
      '@context': 'https://schema.org',
      // A collection of listings, not a Place. Typing this as a City would be a
      // claim to describe Chennai, which this page does not do and should not.
      '@type': 'CollectionPage',
      name: `Rentals in ${name}`,
      description,
      url: cityUrl(city),
      breadcrumb: breadcrumbFor([
        { name: 'Rentals', url: `${ORIGIN}/properties` },
        { name, url: cityUrl(city) },
      ]),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: count,
        itemListElement: city.properties.slice(0, 20).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${ORIGIN}/property/${p.id}`,
          name: p.title,
        })),
      },
    },
  }
}
