// Every service path is relative to the axios baseURL, which already ends in
// /api/v1.
//
// This is a lint rule shaped like a test, and it exists because the failure is
// SILENT AT REVIEW and LOUD ONLY IN PRODUCTION. `api.post('/api/v1/x')` looks
// more correct than `api.post('/x')` — it names the API version, it matches the
// backend route table, and it reads like every curl command anyone has run
// against this server. It is wrong, and nothing catches it: the file compiles,
// the type checker has nothing to say, and the 404 only appears in a browser
// console at runtime.
//
// Three had accumulated by 2026-08-09, and two of them broke shipped features
// nobody had noticed:
//
//   lib/analytics.js         → the entire first-party funnel. map_view, pin_tap
//                              and contact_intent had never reached the server,
//                              so the admin readout only ever showed the
//                              server-side half.
//   locality.service.js ×2   → /rent/:city and /rent/:city/:area. Crawlers got
//                              the server-rendered <head> and were fine; a
//                              human clicking through got a page that could not
//                              load its own data.
//
// Both were live in production: infra/server/deploy.sh builds with
// VITE_API_BASE_URL=/api/v1, so the doubled path resolves there too.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// From import.meta.url, not process.cwd(): `process` is not in the frontend's
// eslint browser env, and this resolves correctly whatever directory vitest is
// invoked from.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.(js|jsx)$/.test(e.name) ? [p] : []
})

/** `api.get('/api/v1/…')`, `adminApi.post(\`/api/v1/…\`)`, any verb, any quote. */
const DOUBLED = /\b(?:api|adminApi)\.(?:get|post|put|patch|delete)\(\s*[`'"]\/api\/v1\//

describe('service paths', () => {
  it('never re-adds /api/v1 on top of the baseURL', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith('api-paths.test.js'))
      .filter((f) => DOUBLED.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(SRC, '').replace(/\\/g, '/'))

    // Named, not counted: a bare "expected 2 to be 0" would leave the next
    // person grepping for which files.
    expect(offenders, `these would resolve to /api/v1/api/v1/…:\n${offenders.join('\n')}`).toEqual([])
  })
})
