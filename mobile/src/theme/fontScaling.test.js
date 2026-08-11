/**
 * Font scaling: what may be capped, and what must never be.
 *
 * Someone who has turned OS text up to 200% has done so because they cannot
 * read it otherwise. `mobile/AGENTS.md` §6 and `.claude/ui-ux.md` both say never
 * to disable `allowFontScaling`, and the reason is that switching it off is not
 * a layout fix — it is refusing the request.
 *
 * So the cap added on 2026-08-11 is deliberately narrow, and this file exists to
 * keep it narrow. The temptation when a screen breaks at 200% is to reach for
 * the nearest global switch; these assertions are what makes that show up as a
 * failing test rather than as a quiet accessibility regression nobody notices
 * because nobody on the team runs their phone at 200%.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CHROME_MAX_FONT_SCALE } from './typography'

const SRC = join(__dirname, '..')

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.js') && !full.endsWith('.test.js') ? [full] : []
  })
}

const files = walk(SRC).map((path) => ({ path, src: readFileSync(path, 'utf8') }))
const rel = (p) => p.slice(SRC.length + 1).replace(/\\/g, '/')

describe('font scaling policy', () => {
  it('found the source tree', () => {
    // Guards every assertion below against a path change making them vacuous.
    expect(files.length).toBeGreaterThan(50)
  })

  it('never disables font scaling anywhere', () => {
    // The one thing that is always wrong. A capped multiplier still grows text;
    // `allowFontScaling={false}` freezes it at the size we chose, which is the
    // whole problem the OS setting exists to solve.
    const offenders = files
      .filter((f) => /allowFontScaling\s*=\s*\{?\s*false/.test(f.src))
      .map((f) => rel(f.path))
    // The array IS the message — jest prints its contents, which names every
    // offending file. (`expect(value, 'msg')` is vitest; jest rejects it.)
    expect(offenders).toEqual([])
  })

  it('caps only CHROME, and only through the shared constant', () => {
    // A literal multiplier is how the policy erodes: one screen picks 1.2,
    // another 1.5, and there is no longer a number to argue with. Every cap in
    // the app has to come from typography.js so there is exactly one.
    const literals = files
      .filter((f) => /maxFontSizeMultiplier\s*=\s*\{\s*[\d.]/.test(f.src))
      .map((f) => rel(f.path))
    expect(literals).toEqual([])
  })

  it('keeps the cap on the short list of surfaces it was argued for', () => {
    // Both conditions have to hold for a cap: the container is geometrically
    // fixed AND the text is redundant. That is a small set, and it should stay
    // small — a new entry here is a claim that some text does not need to be
    // readable, which deserves a conversation rather than a commit.
    const ALLOWED = [
      'components/common/CountBadge.js', // a number in a circle; the list says the same thing
      'navigation/AppTabs.js',           // a label under an icon that already names the destination
    ]
    const capped = files
      .filter((f) => f.src.includes('maxFontSizeMultiplier'))
      .map((f) => rel(f.path))
      .sort()
    expect(capped).toEqual(ALLOWED.sort())
  })

  it('caps no lower than the density every layout already has to survive', () => {
    // `.claude/ui-ux.md` requires dense layouts to work at 1.3x. Capping below
    // that would mean chrome stopped growing before the point the design
    // already commits to handling — a cap that buys nothing and costs
    // readability.
    expect(CHROME_MAX_FONT_SCALE).toBeGreaterThanOrEqual(1.3)
  })

  it('gives text room to grow instead of a fixed box', () => {
    // The general fix, and the one that applies everywhere the cap does not:
    // a box with `height` crops its text at 200%, a box with `minHeight` grows.
    // CountBadge is the component this rule was extracted from.
    const badge = files.find((f) => f.path.endsWith('CountBadge.js')).src
    expect(badge).toMatch(/minHeight/)
    expect(badge)
      .not.toMatch(/\bheight:\s*\d/)
  })
})
