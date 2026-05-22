import { Helmet } from 'react-helmet-async'
import { BRAND, DEFAULT_SEO } from '@lib/seo'

/**
 * Drop this inside any page component to set its <head> tags.
 *
 * Props:
 *   title       — page title (without brand suffix); omit for homepage default
 *   description — meta description (≤160 chars)
 *   image       — absolute OG image URL (1200×630)
 *   canonical   — full canonical URL for this page
 *   noindex     — true to block search engine indexing (auth pages, admin)
 *   jsonLd      — structured data object (JSON-LD) to embed as a script tag
 */
export default function SEOMeta({
  title,
  description = DEFAULT_SEO.description,
  image = DEFAULT_SEO.ogImage,
  canonical,
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title ? `${title} | ${BRAND.name}` : DEFAULT_SEO.title

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
      <meta property="og:site_name"   content={BRAND.name} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={image} />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content={BRAND.twitterHandle} />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={image} />

      {/* Structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}
