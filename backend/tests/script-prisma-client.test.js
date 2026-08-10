/**
 * Every operator script must be able to open a database connection.
 *
 * Prisma 7 removed schema-level `url = env(...)`. A client now connects through
 * an explicit `PrismaPg` driver adapter, so `new PrismaClient()` with no options
 * throws `PrismaClientInitializationError` before it reaches a single query.
 *
 * `.claude/database.md` already says "always use the singleton from
 * src/lib/prisma.js — never `new PrismaClient()`", and under Prisma 7 that
 * stopped being a style preference and became the difference between a script
 * that runs and one that cannot.
 *
 * This exists because `seed-knowledge.mjs` shipped with the bare constructor and
 * was a documented PRODUCTION step (operator-actions §1.6j). It had a test — one
 * that read its source for `upsert` and for the article slugs, and passed
 * happily, because reading a file is not running it. The failure surfaced the
 * only way it could: an operator pasted the documented command and got a stack
 * trace.
 *
 * A script is the one kind of code here with no other coverage. Nothing imports
 * it, no route exercises it, and it runs perhaps twice in its life — the second
 * time under pressure, against production, by someone following a runbook.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts')
const files = readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))

// Comments stripped: this file's own explanations quote the broken form, and so
// do several scripts'. A rule that its own documentation trips is a rule people
// stop believing.
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('scripts can actually connect', () => {
  it('found scripts to check', () => {
    // Every assertion below loops over `files`. An empty list passes vacuously.
    expect(files.length).toBeGreaterThan(15)
  })

  for (const file of files) {
    const src = strip(readFileSync(join(SCRIPTS, file), 'utf8'))
    if (!/new PrismaClient|from '\.\.\/src\/lib\/prisma\.js'/.test(src)) continue

    it(`${file} builds a usable client`, () => {
      const bare = /new PrismaClient\s*\(\s*\)/.test(src)
      expect(
        bare,
        `${file} calls new PrismaClient() with no options. Prisma 7 throws on that `
        + 'before the first query — import { prisma } from "../src/lib/prisma.js", '
        + 'or pass a PrismaPg adapter as seed-amenities.mjs does.',
      ).toBe(false)

      // Having ruled out the bare form, whatever remains must be one of the two
      // shapes that work.
      const singleton = /from '\.\.\/src\/lib\/prisma\.js'/.test(src)
      const adapter = /new PrismaClient\s*\(\s*\{[\s\S]*?adapter/.test(src)
      expect(
        singleton || adapter,
        `${file} constructs a PrismaClient without a driver adapter`,
      ).toBe(true)
    })
  }
})

describe('the documented invocation matches the script', () => {
  // A script that does not load dotenv itself needs `--env-file` on the command
  // line, and ops.md warns this is inconsistent across the directory: "a bare
  // `node script.mjs` silently targets nothing usable." Where a script writes
  // its own Run: line, that line has to be the one that works.
  for (const file of files) {
    const src = readFileSync(join(SCRIPTS, file), 'utf8')
    const documented = /\*\s*Run:\s*(.+)/.exec(src)?.[1]?.trim()
    if (!documented) continue

    it(`${file} documents a command that loads its env`, () => {
      const loadsDotenv = /dotenv\/config/.test(strip(src))
      if (loadsDotenv) return   // env arrives on import; the flag is optional

      expect(
        /--env-file|DATABASE_URL=/.test(documented),
        `${file} does not import dotenv, so its documented command needs `
        + `--env-file (or a DATABASE_URL= prefix). It says: ${documented}`,
      ).toBe(true)
    })
  }
})
