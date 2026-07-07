// ── Brand & SEO config ───────────────────────────────────────────────────────
// Every title, description, and OG tag pulls from here — one change updates all.

export const BRAND = {
  name: 'StayOnMap',
  tagline: 'Rent with intelligence.',
  // www is canonical: the apex's DNS (Squarespace) can't point at Railway
  // (no ALIAS support) and its redirect drops paths — only www reliably
  // serves the app. Keep every generated URL on www.
  domain: 'https://www.stayonmap.com',
  twitterHandle: '@StayOnMap',
}

export const DEFAULT_SEO = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    'Every rental on StayOnMap is scored live by a TrustScore engine and fraud-detection agent. Search verified homes on a live map across India.',
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
