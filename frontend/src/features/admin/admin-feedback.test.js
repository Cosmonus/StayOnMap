// Two lint rules shaped like tests, both about admin actions that fail QUIETLY.
//
// The admin panel is the one surface where a silent failure is indistinguishable
// from success: an approve that 500s leaves the row exactly where a pending row
// already was, and the next thing the admin does is click it again.
//
// Found by hand on 2026-08-10:
//
//   1. Four moderation mutations had no `onError` at all — reports moderate,
//      review status, verification review, and the users-list block toggle.
//      Two OTHER mutations in the same file did it correctly, which is what
//      made the gap invisible in review.
//   2. Two `catch` blocks read `err.response?.data?.message`. Both axios
//      instances in lib/api.js reject with `err.response?.data ?? err` — the
//      BODY — so `err.response` does not exist on a rejection and the server's
//      own message was always thrown away in favour of a generic fallback.
//      That one compounded the next bug found: the admin password floor
//      disagreed with the server's, and the resulting 400 could not explain
//      itself.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.(js|jsx)$/.test(e.name) ? [p] : []
})

const rel = (f) => f.replace(SRC, '').replace(/\\/g, '/')
const jsFiles = () => walk(SRC).filter((f) => !f.includes('.test.'))

/** Files that talk to the admin API. */
const adminFiles = () => jsFiles().filter((f) => /\badminApi\b|adminService/.test(readFileSync(f, 'utf8')))

/**
 * Split a file on `useMutation({` and take each call's own object literal, by
 * counting braces. Regex alone cannot see where one mutation ends and the next
 * begins, and a whole-file search for "onError" would pass a file where only
 * one of five mutations has it — which is exactly the state this catches.
 */
function mutationBlocks(src) {
  return [...src.matchAll(/useMutation\(\{/g)].map((m) => {
    let depth = 1
    let i = m.index + m[0].length
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      i++
    }
    return src.slice(m.index, i)
  })
}

describe('admin mutations', () => {
  it('every one of them handles its own failure', () => {
    const offenders = adminFiles().flatMap((f) => {
      const src = readFileSync(f, 'utf8')
      return mutationBlocks(src)
        .filter((b) => !/onError\s*:/.test(b))
        .map((b) => `${rel(f)} → ${(/mutationFn:.*/.exec(b)?.[0] ?? '').trim().slice(0, 90)}`)
    })

    expect(
      offenders,
      `these fail with no feedback — the list just doesn't change:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

describe('error message reads', () => {
  it('never reach through err.response — both axios instances reject with the body', () => {
    const offenders = jsFiles()
      .filter((f) => /err(or)?\??\.response\??\.\s*data/.test(readFileSync(f, 'utf8')))
      .filter((f) => !f.endsWith(join('lib', 'api.js'))) // where the unwrapping is DONE
      .map(rel)

    expect(
      offenders,
      `err.response is undefined on a rejection — read err.message:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
