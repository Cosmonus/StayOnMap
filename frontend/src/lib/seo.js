// ── Brand & SEO config ───────────────────────────────────────────────────────
// Every title, description, and OG tag pulls from here — one change updates all.

export const BRAND = {
  name: 'StayOnMap',
  tagline: 'Rent with intelligence.',
  // www is canonical: the apex 301-redirects to www and drops the path/query
  // in the process, so only www reliably serves the app. Keep every generated
  // URL on www.
  domain: 'https://www.stayonmap.com',
  twitterHandle: '@StayOnMap',
}

// The Android app's Play Store listing — the one place the URL is written.
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.stayonmap.app'

// The WhatsApp listing bot (+91 73582 47801) — the one place the number is
// written. The prefilled text is what opens the bot's listing flow.
export const WHATSAPP_LIST_URL =
  'https://wa.me/917358247801?text=' + encodeURIComponent('Hi, I want to list my property')

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
