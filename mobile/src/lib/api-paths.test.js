// Every service path is relative to the axios baseURL, which already ends in
// /api/v1 (EXPO_PUBLIC_API_BASE_URL — see .env.example and eas.json).
//
// The web port of this lint has existed since 2026-08-09. Mobile did not have
// one, and that is precisely how `lib/analytics.js` sat posting
// `/api/v1/analytics/events` — resolving to /api/v1/api/v1/… — from the day it
// was ported until 2026-08-10. Every event the app ever recorded 404'd, and the
// deliberate `catch {}` around telemetry (correct on its own terms: a retry
// queue would add load exactly when the network is failing) meant nothing was
// ever logged, thrown or shown. The first-party funnel had never counted a
// single mobile session, on a product whose users are mostly on phones.
//
// The absolute form is the one that LOOKS right: it names the API version, it
// matches the backend route table, and it is what every curl against this
// server says. Nothing but this catches it.
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const SRC = join(__dirname, '..')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.js$/.test(e.name) ? [p] : []
})

/** `api.get('/api/v1/…')`, any verb, any quote style. */
const DOUBLED = /\bapi\.(?:get|post|put|patch|delete)\(\s*[`'"]\/api\/v1\//

describe('service paths', () => {
  it('never re-adds /api/v1 on top of the baseURL', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith('api-paths.test.js'))
      .filter((f) => DOUBLED.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(SRC, '').replace(/\\/g, '/'))

    // Named, not counted: "expected 1 to be 0" would leave the next person
    // grepping for which file.
    expect(offenders).toEqual([])
  })
})
