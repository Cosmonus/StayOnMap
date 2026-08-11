/**
 * Reading the source tree, for the policy tests that enforce a rule no runtime
 * assertion can reach — a cap that must not spread, a screen that must have
 * decided about width. Both are properties of what is WRITTEN, not of what a
 * render produces.
 *
 * Shared because of one specific bug: `largeScreen.test.js`'s first run flagged
 * `PropertyDetailScreen.js` for `Dimensions.get`, and the only occurrence was
 * the comment explaining why `Dimensions.get` had just been removed. A source
 * scan cannot tell code from prose ABOUT code, and prose about a banned pattern
 * is exactly where that pattern turns up most. Stripping comments is therefore
 * part of the primitive, not something each test remembers to do.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.js') && !full.endsWith('.test.js') ? [full] : []
  })
}

/** `//` only when not preceded by `:`, so `https://…` in a string survives. */
export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Every non-test `.js` under `root`, as `{ path, src }` with comments removed.
 * `path` is root-relative with forward slashes, so an assertion failure prints
 * the same string on Windows and CI.
 */
export function readSource(root) {
  return walk(root).map((path) => ({
    path: path.slice(root.length + 1).replace(/\\/g, '/'),
    src: stripComments(readFileSync(path, 'utf8')),
  }))
}
