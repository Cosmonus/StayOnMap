/**
 * A failed admin fetch must never render as an empty list.
 *
 * Every section in AdminPage destructured `{ data, isLoading }` and nothing
 * else, so a rejected query left `data` undefined and fell through to
 * `data?.properties ?? []` — the EMPTY state. On a moderation surface that is
 * the worst failure available: a reports queue that could not load is
 * indistinguishable from a queue with nothing in it, and an admin reads "all
 * clear" off a screen that failed.
 *
 * This is a SOURCE SCAN rather than a render test, deliberately. The sections
 * are internal to a 2,600-line page and none is exported; mounting the whole
 * page to prove one branch would be a fragile test of routing and Google Maps.
 * What actually needs guarding is the habit — that the next section added here
 * captures `isError` like its neighbours — and that is a property of the file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'AdminPage.jsx'),
  'utf8',
)

describe('AdminPage query error states', () => {
  it('has no query that captures loading but not failure', () => {
    // The exact shape every section shipped with. Finding it again means a
    // section can render its empty state on a network error.
    const unguarded = source.match(/const \{\s*data,\s*isLoading\s*\} = useQuery\(/g) ?? []
    expect(
      unguarded.length,
      'a useQuery here captures isLoading but not isError — its empty state will render on failure',
    ).toBe(0)
  })

  it('guards every section that captures isError', () => {
    // Capturing it and not branching on it is the same bug with extra steps.
    const captured = (source.match(/isError/g) ?? []).length
    const guards = (source.match(/<SectionError /g) ?? []).length
    expect(guards).toBeGreaterThan(0)
    // One capture per destructure + one per guard, so guards can never trail.
    expect(guards).toBeGreaterThanOrEqual(captured - guards)
  })

  it('says the list failed rather than that it is empty', () => {
    // The wording is the whole point of the component. "Something went wrong"
    // above an empty table is barely better than the empty table.
    expect(source).toContain('This is a failure to fetch, not an empty list')
  })

  it('offers a retry', () => {
    const block = source.slice(source.indexOf('function SectionError'))
    expect(block.slice(0, 1200)).toContain('onRetry')
  })
})
