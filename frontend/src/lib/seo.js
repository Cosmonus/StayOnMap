// ── Brand & SEO config ───────────────────────────────────────────────────────
// TODO: Update BRAND_NAME once the name is finalised.
// Every title, description, and OG tag pulls from here — one change updates all.

export const BRAND = {
  name: 'StayOnMap',
  tagline: 'Find your place.',
  domain: 'https://stayonmap.in',
  twitterHandle: '@StayOnMap',
}

export const DEFAULT_SEO = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    'Every listing is a real home. Every home has a real owner. Find your place on the map — no brokers, no paywalls, no nonsense.',
  ogImage: `${BRAND.domain}/og-default.jpg`, // ← add a 1200×630 image to /public
}

/** Build a page title: "Koramangala 2BHK | StayOnMap" */
export function pageTitle(suffix) {
  return suffix ? `${suffix} | ${BRAND.name}` : DEFAULT_SEO.title
}

/** Canonical URL for a given path */
export function canonical(path = '/') {
  return `${BRAND.domain}${path}`
}
