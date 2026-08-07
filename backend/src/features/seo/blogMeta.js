// Title, description and structured data for the blog index and one article.
//
// Two things here are deliberate and easy to get wrong later:
//
// 1. `seoTitle` is a SEPARATE field from `title`. The H1 on the page is
//    written for a person mid-scroll; the <title> is written for a 60-character
//    search result. Deriving one from the other means one of the two is always
//    the wrong length, and truncating an H1 at 60 characters is how
//    "…in India — What Every First-Time Renter Should Know Before" happens.
//
// 2. The FAQ block emits `FAQPage` ONLY when the article actually renders
//    those questions and answers on the page. Google's structured-data policy
//    requires the marked-up content to be visible to the user, and marking up
//    an FAQ the reader cannot see is the kind of thing that costs a rich
//    result and, repeated, a site's standing. Our article template always
//    renders `faq`, so the two cannot drift — but if a future template hides
//    it, this is the line that has to change with it.
import { ORIGIN } from './prerender.service.js'

const PUBLISHER = {
  '@type': 'Organization',
  name: 'StayOnMap',
  url: ORIGIN,
  logo: { '@type': 'ImageObject', url: `${ORIGIN}/icon-192.png` },
}

// `seoTitle` in a post file is stored WITHOUT the brand, and both renderers
// append this. The frontend's SEOMeta component does the same thing to its
// `title` prop, so storing "… | StayOnMap" in the file would render
// "… | StayOnMap | StayOnMap" the moment React hydrated over the server's head.
// One rule, applied in both places: the file holds the bare title.
//
// Budget it at ~45 characters — the 60-character target everyone quotes is for
// the WHOLE title, and this suffix spends 12 of them.
const BRAND_SUFFIX = ' | StayOnMap'

export function postUrl(slug) {
  return `${ORIGIN}/blog/${slug}`
}

/** ISO-8601 with no time component — the date is all we author, so it is all we claim. */
const isoDate = (d) => new Date(d).toISOString().slice(0, 10)

export function metaForPost(post) {
  const url = postUrl(post.slug)
  const image = post.hero?.url ? `${ORIGIN}${post.hero.url}` : `${ORIGIN}/og-default.jpg`

  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      datePublished: isoDate(post.publishedAt),
      dateModified: isoDate(post.updatedAt),
      author: { '@type': 'Person', name: post.author.name, ...(post.author.url ? { url: post.author.url } : {}) },
      publisher: PUBLISHER,
      image,
      keywords: post.tags.join(', '),
      articleSection: post.clusterLabel,
      wordCount: post.body.trim().split(/\s+/).length,
      inLanguage: 'en-IN',
    },
  ]

  if (post.faq?.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
  }

  return {
    title: post.seoTitle + BRAND_SUFFIX,
    description: post.description,
    canonical: url,
    type: 'article',
    image,
    // One <script> per graph entry rather than an @graph array: both are valid,
    // and separate blocks keep a malformed FAQ from invalidating the article
    // markup alongside it.
    jsonLd: graph.length === 1 ? graph[0] : graph,
  }
}

export const BLOG_INDEX_TITLE = 'Renting in India — guides & city insights'

export function metaForBlogIndex(posts) {
  const url = `${ORIGIN}/blog`
  return {
    title: BLOG_INDEX_TITLE + BRAND_SUFFIX,
    description:
      'Practical guides to renting in India: agreements, deposits, tenant rights, '
      + 'city and neighbourhood comparisons, and what the data actually says.',
    canonical: url,
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'StayOnMap Blog',
      url,
      publisher: PUBLISHER,
      inLanguage: 'en-IN',
      blogPost: posts.slice(0, 20).map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        url: postUrl(p.slug),
        datePublished: isoDate(p.publishedAt),
        author: { '@type': 'Person', name: p.author.name },
      })),
    },
  }
}
