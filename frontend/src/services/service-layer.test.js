// Components call services; only services call axios.
//
// The rule is in CLAUDE.md ("All API calls go through services/, never direct
// fetch/axios in components") and it held everywhere but one line:
// `PointsCard.jsx` did `api.get('/points')` inline. One exception, and it cost
// nothing on its own — which is precisely the problem. A rule with a single
// live exception is what the second one gets argued from, and by the fourth
// nobody can say where the API surface is any more.
//
// Enforced as a lint rather than remembered, because the violation is INVISIBLE
// in review: `api.get('/points')` is shorter and clearer at the call site than
// `pointsService.getSummary()`, and nothing about it looks wrong.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.(js|jsx)$/.test(e.name) ? [p] : []
})

const rel = (f) => f.replace(SRC, '').replace(/\\/g, '/')

/** Files outside services/ and lib/, excluding tests. */
const componentFiles = () => walk(SRC).filter((f) => {
  const r = rel(f)
  return !r.startsWith('/services/') && !r.startsWith('/lib/') && !r.includes('.test.')
})

describe('the service layer', () => {
  it('is the only place that imports an axios instance', () => {
    const offenders = componentFiles()
      .filter((f) => /from\s+['"]@lib\/api['"]/.test(readFileSync(f, 'utf8')))
      .map(rel)

    expect(
      offenders,
      `these reach past services/ to the axios instance:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('is the only place that calls axios or fetch directly', () => {
    // `fetch(` catches the other half of the same rule. Excludes the string
    // "prefetch"/"refetch", which are React Query and not a network call.
    const offenders = componentFiles()
      .filter((f) => /(^|[^.\w])(?:axios|fetch)\s*\(/.test(
        readFileSync(f, 'utf8').replace(/\b(?:pre|re)fetch\b/g, ''),
      ))
      .map(rel)

    expect(
      offenders,
      `these bypass the service layer:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
