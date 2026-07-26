/**
 * Legal-document parity — web JSX vs the mobile app's rendered copy.
 *
 * The Privacy Policy and Terms exist twice: as prose in
 * frontend/src/pages/{PrivacyPolicyPage,TermsOfServicePage}.jsx, and as data in
 * mobile/src/features/legal/content.js (mobile renders them as real screens
 * instead of opening the website). Two copies of a legal text that disagree is
 * a legal problem, not a formatting one, and nothing else in this repo would
 * notice — the same reasoning as amenities.test.js.
 *
 * What this can check, and what it can't: it compares the SECTION HEADINGS and
 * the "Last updated" date, so an added, removed, renamed or reordered section
 * fails, and so does a web edit that bumps the date without updating mobile.
 * It cannot compare body prose (one side is JSX with entities and links, the
 * other is plain strings). Bumping the date on a material edit is the
 * convention that makes this cover body changes too — the policy's own
 * "Changes to this policy" section promises exactly that.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8')

// Entities the web pages use inside section titles, so the two sides compare
// as the same characters rather than as markup.
const ENTITIES = { '&amp;': '&', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–' }
const decode = (s) => Object.entries(ENTITIES).reduce((acc, [e, c]) => acc.split(e).join(c), s)

function webSectionTitles(file) {
  const src = read('frontend', 'src', 'pages', file)
  return [...src.matchAll(/<Section\s+id="[^"]+"\s+title="([^"]+)"/g)].map((m) => decode(m[1]))
}

function webLastUpdated(file) {
  const src = read('frontend', 'src', 'pages', file)
  const m = /lastUpdated="([^"]+)"/.exec(src)
  expect(m, `${file} has no lastUpdated`).toBeTruthy()
  return m[1]
}

function mobileDoc(exportName) {
  const src = read('mobile', 'src', 'features', 'legal', 'content.js')
  // The file is ESM with an @config alias, so it cannot simply be imported from
  // here. Slice the one export and read its section titles off the source.
  const start = src.indexOf(`export const ${exportName} = {`)
  expect(start, `${exportName} missing from mobile content.js`).toBeGreaterThan(-1)
  const rest = src.slice(start)
  const end = rest.indexOf('\nexport const ')
  const block = end === -1 ? rest : rest.slice(0, end)
  return [...block.matchAll(/^\s{6}title: '([^']+)',$/gm)].map((m) => m[1])
}

function mobileLastUpdated() {
  const src = read('mobile', 'src', 'features', 'legal', 'content.js')
  const m = /export const LAST_UPDATED = '([^']+)'/.exec(src)
  expect(m, 'mobile content.js has no LAST_UPDATED').toBeTruthy()
  return m[1]
}

describe('legal document parity (web ↔ mobile)', () => {
  it('privacy policy has the same sections on both platforms', () => {
    const web = webSectionTitles('PrivacyPolicyPage.jsx')
    expect(web.length).toBeGreaterThan(0)
    expect(mobileDoc('PRIVACY')).toEqual(web)
  })

  it('terms of service has the same sections on both platforms', () => {
    const web = webSectionTitles('TermsOfServicePage.jsx')
    expect(web.length).toBeGreaterThan(0)
    expect(mobileDoc('TERMS')).toEqual(web)
  })

  it('both documents carry the same "last updated" date on both platforms', () => {
    const privacy = webLastUpdated('PrivacyPolicyPage.jsx')
    const terms = webLastUpdated('TermsOfServicePage.jsx')
    // One date on mobile covers both docs, so the two web pages must agree too.
    expect(terms).toBe(privacy)
    expect(mobileLastUpdated()).toBe(privacy)
  })
})
