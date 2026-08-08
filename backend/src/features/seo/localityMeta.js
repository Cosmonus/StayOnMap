// Title, description and structured data for a locality landing page.
//
// The page answers one question — "what can I rent in Anna Nagar, and roughly
// what does it cost" — so its title and description are the count and the
// median, both measured from live inventory. Nothing is claimed about the
// neighbourhood that the listings themselves do not say; the spatial layer's
// facts live on the property pages, where they are anchored to a coordinate
// rather than to a name.
import { ORIGIN } from './prerender.service.js'

const inr = (n) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n))}`

export function localityUrl(locality) {
  return `${ORIGIN}/rent/${locality.citySlug}/${locality.localitySlug}`
}

export function metaForLocality(locality) {
  const { locality: name, city, count, medianRent } = locality
  const homes = `${count} ${count === 1 ? 'home' : 'homes'}`

  const title = `Rent in ${name}, ${city} — ${homes} without brokerage | StayOnMap`

  const description = [
    `${homes} for rent in ${name}, ${city}, listed directly by owners.`,
    medianRent ? `Median rent ${inr(medianRent)}/mo.` : null,
    'No brokerage, no agents — see them on the map.',
  ].filter(Boolean).join(' ')

  return {
    title,
    description,
    canonical: localityUrl(locality),
    type: 'website',
    // Withheld from search when the area came from an owner's free text rather
    // than from a map boundary — see locality.service.js's isIndexable(). The
    // page still renders and still works for anyone holding the link; `follow`
    // rather than `nofollow` because its links to real property pages are worth
    // crawling even when the page itself is not worth ranking.
    noindex: locality.indexable === false,
    jsonLd: {
      '@context': 'https://schema.org',
      // A list of listings, not a Place: the page IS a collection, and typing
      // it as a neighbourhood would be a claim to describe the neighbourhood.
      '@type': 'CollectionPage',
      name: `Rentals in ${name}, ${city}`,
      description,
      url: localityUrl(locality),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: count,
        itemListElement: locality.properties.slice(0, 20).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${ORIGIN}/property/${p.id}`,
          name: p.title,
        })),
      },
    },
  }
}
