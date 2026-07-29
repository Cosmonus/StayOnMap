// The flood refusal, enforced across the WHOLE repo — not one module.
//
// Why this file exists. `.claude/spatial.md` names inferring flood risk from
// elevation as a standing refusal, and four test files enforced it:
// spatial-phase3, spatial-property-types, spatial-roads, spatial-water. Every
// one of them imports a module from features/spatial/ and asserts on its
// output. All four passed, continuously, while `trust.service.js` — written
// before features/spatial/ existed — computed a 0-10 "flood safety" score from
// a single Google Elevation call and shipped it to users on the property page
// of both platforms as "Flood safety 9.0/10".
//
// The refusal was real. The tests were real. The overlap was empty.
//
// So this suite does not import anything. It reads source files off disk and
// asserts the forbidden thing is absent from the codebase, which is the only
// shape of test that could have caught the original bug. `todo.md`'s 07-29
// entry states the lesson: **when a rule is worth a test, grep the whole
// codebase for the thing it forbids before believing the test covers you.**
//
// Deliberately OUT of scope: `src/data/area-profiles.json`'s `floodRisk`, and
// the AreaInsightCard rows that render it. Those are hand-authored per-area
// facts citing published designations ("one of GHMC's two major flood zones"),
// not a number inferred from terrain. That is a different category and a
// separate question — it has no provenance framework, which is worth revisiting
// — but it is not what this test governs, and silently folding it in here would
// hide the distinction rather than settle it.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')

const TREES = [
  join(REPO, 'backend/src'),
  join(REPO, 'frontend/src'),
  join(REPO, 'mobile/src'),
]

const CODE = new Set(['.js', '.jsx', '.ts', '.tsx'])

function sourceFiles(dir) {
  if (!existsSync(dir)) return [] // frontend/mobile absent in a partial checkout
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (CODE.has(extname(entry))) out.push(full)
  }
  return out
}

const FILES = TREES.flatMap(sourceFiles).map((path) => ({
  path: path.slice(REPO.length + 1).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}))

// A line that only *names* the refusal (the comments explaining why the score
// is gone) is the point of the refusal, not a breach of it. Strip comments
// before matching so the explanation can stay in the code where it is useful.
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
}

describe('flood refusal holds across the whole codebase', () => {
  it('sanity: the scan actually found the source trees', () => {
    expect(FILES.length).toBeGreaterThan(300)
  })

  it('no file computes, stores, or reads a floodSafeRating', () => {
    const offenders = FILES
      .filter((f) => /floodSafeRating/.test(codeOnly(f.text)))
      .map((f) => f.path)

    expect(offenders, [
      'A floodSafeRating is back. It was removed on 2026-07-30 because it was',
      'an elevation ladder rendered to users as a safety score.',
      'Elevation belongs in the spatial layer\'s terrain module — in metres,',
      'MEASURED, with provenance and a confidence band.',
    ].join('\n')).toEqual([])
  })

  it('no UI renders a flood safety claim as a score', () => {
    // The label is what a user actually reads. Catch it in any casing, and
    // catch "flood risk"/"flood score" alongside it — a rename is the most
    // likely way this comes back.
    const CLAIM = /["'`][^"'`]*flood\s*(safety|score|rating|safe)[^"'`]*["'`]/i

    const offenders = FILES
      .filter((f) => CLAIM.test(codeOnly(f.text)))
      .map((f) => f.path)

    expect(offenders, 'A flood safety claim is being rendered again.').toEqual([])
  })

  it('the trust engine makes no elevation call at all', () => {
    // computeFloodSafe was the only caller of googleElevation. Asserting the
    // API is unreachable from here is stronger than asserting one function is
    // gone: it closes the route back in, rather than the last thing that used it.
    const trust = FILES.find((f) => f.path.endsWith('features/trust/trust.service.js'))
    expect(trust, 'trust.service.js not found — did it move?').toBeDefined()

    const code = codeOnly(trust.text)
    expect(code).not.toMatch(/elevation/i)
    expect(code).not.toMatch(/maps\/api\/elevation/)
  })
})
