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
import { readFileSync, existsSync } from 'node:fs'
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
  '.supabase.co',          // listing photos and verification documents
]

// fonts.googleapis.com and fonts.gstatic.com were on this list until
// 2026-08-10 and are now REMOVED, not merely unused: the three families are
// served from /public/fonts, so the page reaches for them no more. The comment
// above promised removing a host would be free, and it was. Re-adding either
// one is a real decision — it puts an IP address in front of Google on every
// page load — so let this test fail rather than widening the list back.
const REMOVED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

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

  it('no longer fetches its fonts from Google', () => {
    // Not covered by the check above: those hosts WERE allow-listed, so a
    // regression would have passed silently for exactly as long as the list
    // still named them.
    const src = withoutComments(indexHtml())
    for (const host of REMOVED_HOSTS) {
      expect(src, `index.html reaches ${host} again — the fonts are self-hosted`).not.toContain(host)
    }
  })

  it('serves every self-hosted font file it declares', () => {
    // A @font-face pointing at a missing file is invisible: the browser falls
    // back silently and the site renders in Arial for everyone.
    const css = readFileSync(join(ROOT, 'frontend', 'src', 'index.css'), 'utf8')
    const declared = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1])
    expect(declared.length).toBeGreaterThan(0)
    for (const file of new Set(declared)) {
      expect(
        existsSync(join(ROOT, 'frontend', 'public', 'fonts', file)),
        `index.css declares /fonts/${file}, which is not in frontend/public/fonts`,
      ).toBe(true)
    }
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
