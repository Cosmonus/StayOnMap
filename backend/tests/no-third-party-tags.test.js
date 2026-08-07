/**
 * The website loads nothing that measures anybody — and /privacy says so.
 *
 * §8 of both Privacy Policies (web JSX and the mobile app's copy) now makes a
 * flat, checkable promise: the Platform sets no cookies, and there is no
 * analytics or advertising tag on any page. That promise is not enforced by
 * anything in the app itself — a single <script src="…"> pasted into
 * index.html would break it silently, and the page would look and behave
 * exactly the same.
 *
 * This is the same class of gap as amenities.test.js and legal-parity.test.js:
 * two artefacts that must agree, with nothing between them that would notice.
 *
 * History, so nobody re-litigates it from scratch: a GA4 gtag ran here for
 * part of 2026-08-07 and was removed the same day by operator decision. It
 * worked; it cost `_ga` cookies lasting two years, which was the only reason
 * the product needed a cookie section or a consent banner. The first-party
 * funnel in features/analytics answers the same business question from our own
 * Postgres with a sessionStorage id that is not a cookie.
 *
 * GA4 still receives the MOBILE APP's funnel, forwarded server-side
 * (features/analytics/ga4.js). That path sets no cookie on anybody and needs
 * no script in this file — which is exactly why the gate lives on the request,
 * not here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const indexHtml = () => readFileSync(join(ROOT, 'frontend', 'index.html'), 'utf8')

// Everything the page is allowed to reach for, and why. Each one DELIVERS a
// file the page cannot render without, which means it sees an IP address —
// that is disclosed in /privacy §7 and named again in §8. None of them
// measures anything, and none sets a cookie here.
//
// Adding a host to this list is the deliberate act the test exists to force:
// it is a diff on this line, next to the sentence in §7 it obliges you to
// write. Removing one (self-hosting the fonts, for instance) is free.
//
// This list caught a real overclaim on the day it was written — a first draft
// of §8 said "no third-party tag of any kind", which was false about the four
// entries below. The policy was narrowed to what is true; the test was not
// widened to fit the policy.
const ALLOWED_HOSTS = [
  'maps.googleapis.com',   // the Maps JS SDK — the product IS the map
  'maps.gstatic.com',      // map tiles and sprites for the above
  'fonts.googleapis.com',  // Plus Jakarta Sans / Fraunces / JetBrains Mono
  'fonts.gstatic.com',     // the font files themselves
  '.supabase.co',          // listing photos and verification documents
]

// Strip HTML comments first — this file documents the removed tag by name, and
// a checker that reads its own warning as a violation is worse than useless.
const withoutComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '')

function externalUrls(html) {
  const src = withoutComments(html)
  return [...src.matchAll(/(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/gi)]
    .map((m) => m[1])
    .filter((url) => !ALLOWED_HOSTS.some((host) => url.includes(host)))
}

describe('frontend/index.html loads nothing that measures anybody', () => {
  it('reaches only for hosts that DELIVER a file, all of them disclosed', () => {
    // The failure message names the offender, because the fix is a decision
    // (does /privacy §8 have to change?) rather than a deletion.
    expect(externalUrls(indexHtml())).toEqual([])
  })

  it('has no analytics or tag-manager snippet', () => {
    const src = withoutComments(indexHtml())
    for (const marker of ['googletagmanager', 'google-analytics', 'gtag(', 'dataLayer', 'fbq(', 'clarity', 'hotjar']) {
      expect(src, `index.html contains "${marker}"`).not.toContain(marker)
    }
  })
})

describe('the privacy policies keep saying it', () => {
  // If someone re-adds a tag and updates the policy honestly, the test above
  // fails and this one passes — which is the correct pairing. What must never
  // happen is a tag returning while the page still promises there is none.
  const web = () => readFileSync(join(ROOT, 'frontend', 'src', 'pages', 'PrivacyPolicyPage.jsx'), 'utf8')
  const mobile = () => readFileSync(join(ROOT, 'mobile', 'src', 'features', 'legal', 'content.js'), 'utf8')

  it('web §8 states the Platform sets no cookies', () => {
    expect(web()).toContain('sets no cookies at all')
  })

  it('mobile §8 states the same', () => {
    expect(mobile()).toContain('sets no cookies at all')
  })
})
