// No live credentials in prose files.
//
// Why this file exists, and why it is a TEST rather than a CI step. On
// 2026-08-06 `infra/server/README-gcp.md` was found holding a verbatim dump of
// production's `api.env` — `JWT_SECRET`, `ADMIN_JWT_SECRET`,
// `SUPABASE_SERVICE_ROLE_KEY`, the ZeptoMail token, the unrestricted Google
// Maps key, a Redis URL with its password — pasted under the operator runbook.
//
// Nothing leaked: the file is untracked (the gitignore's `!README.md` exception
// matches that literal name, and `README-gcp.md` is not it). **And that is
// exactly why CI could not have caught it.** The `guard` job scans a git range
// on a fresh clone; a file that was never committed does not exist there. A
// working-tree scan in CI would not help either, for the same reason.
//
// The test suite is the one thing that runs against a developer's actual disk.
// So the guard lives here: locally it sees the file, and in CI it is a cheap
// no-op over the same docs.
//
// Scope: prose only (.md, .txt) plus `.example` env templates. Real `.env`
// files are gitignored and are where secrets BELONG — scanning them would fail
// on every machine that works.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'graphify-out', // generated, mirrors source that is itself scanned
  'android', 'ios', '.expo',
])

const PROSE = new Set(['.md', '.txt'])

function proseFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) out.push(...proseFiles(full))
    else if (PROSE.has(extname(entry)) || entry.endsWith('.example')) out.push(full)
  }
  return out
}

// Each pattern is a SHAPE that only a real credential has. Placeholders in this
// repo ("CHANGE_ME", "your_..._here", "ci-placeholder", "<key>") do not match,
// which is what keeps the docs writable.
const PATTERNS = [
  {
    name: 'Google API key',
    // AIza + 35 of the exact alphabet Google issues.
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: 'Supabase / JWT service key',
    // A three-part JWT whose header decodes to real JSON. The header segment of
    // any HS256 JWT starts eyJhbGciOi…, and placeholders never do.
    re: /\beyJhbGciOi[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\b/,
  },
  {
    name: 'database/redis URL with an embedded password',
    // scheme://user:secret@host. The password is the part that matters, and
    // separating a real one from a placeholder by BLACKLIST does not work — the
    // first draft of this test flagged three legitimate templates, because
    // there is always one more way to write "put your password here".
    //
    // So it asks what a real secret looks like instead: long and mixed-case.
    // Every placeholder in this repo is bracketed, SHOUTED with underscores, or
    // a single lowercase word, and none of those survive that question.
    detect: (text) => {
      const URL_RE = /\b(?:postgres(?:ql)?|rediss?|mongodb(?:\+srv)?):\/\/[^\s:@/]+:([^\s:@/]+)@/g
      for (const m of text.matchAll(URL_RE)) {
        const pw = m[1]
        if (/[<>{}$%]/.test(pw)) continue                      // <password>, ${DB_PASS}
        if (pw.length < 16) continue                           // password, changeme
        if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) continue   // REPLACE_WITH_...
        return true
      }
      return false
    },
  },
  {
    name: 'Google OAuth client secret',
    re: /\bGOCSPX-[0-9A-Za-z_-]{20,}\b/,
  },
  {
    name: 'Zoho ZeptoMail send token',
    re: /\bZoho-enczapikey\s+\S{30,}/,
  },
]

const FILES = proseFiles(REPO).map((path) => ({
  path: path.slice(REPO.length + 1).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}))

describe('prose files carry no live credentials', () => {
  // Canary: if the walk stops finding files, every assertion below passes
  // vacuously and this suite becomes decoration.
  //
  // Anchored on a file that is TRACKED, not on a count. The first version
  // asserted `> 20` and passed locally while failing in CI, because almost all
  // of this repo's prose is gitignored (.gitignore blocks `*.md` except
  // READMEs, plus `docs/` and `.claude/`): a working tree has 100+ prose files
  // and a fresh clone has 8. A count calibrated on one is wrong on the other —
  // and the number that matters is "more than zero", not "more than twenty".
  it('has documentation to scan', () => {
    expect(FILES.map((f) => f.path)).toContain('README.md')
  })

  for (const { name, re, detect } of PATTERNS) {
    const matches = detect ?? ((text) => re.test(text))
    it(`contains no ${name}`, () => {
      const hits = FILES
        .filter(({ text }) => matches(text))
        // The VALUE is never printed, in a failure message that lands in a CI
        // log and a terminal scrollback. The path is enough to act on.
        .map(({ path }) => path)

      expect(hits, [
        `A ${name} appears in a documentation file. Remove it, then ROTATE it —`,
        'assume anything written to disk in plaintext is compromised. Env values',
        'belong in /etc/stayonmap/api.env and nowhere else; a runbook should name',
        'the KEY and never the VALUE.',
      ].join(' ')).toEqual([])
    })
  }
})
