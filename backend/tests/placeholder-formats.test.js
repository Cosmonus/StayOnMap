// A placeholder is a SPECIFICATION, and it must pass the validator that reads
// the field.
//
// Why this file exists. On 2026-08-01 a user reported that "they have a section
// to add phone number but its not working while listing". The field was fine.
// The PLACEHOLDER was wrong: `users.validation.js` accepts ten bare digits
// (`/^[6-9]\d{9}$/`) after a plain `.trim()`, which strips the ENDS of a string
// and nothing else — so an internal space is fatal. All three phone
// placeholders in the app demonstrated a failing value:
//
//     mobile PublishGate   "98450 12345"
//     web    PublishGate   "+91 98450 12345"
//     web    Settings      "+91 98765 43210"
//
// Every one of them taught the user a format the server rejects, and the app
// then blamed the user for typing what it had shown them.
//
// `todo.md`'s bug log states the promotion: **one test asserting every phone
// placeholder satisfies PHONE_RE would have caught all three**, and it
// generalises to any format demonstrated to a user. So this suite reads source
// off disk rather than importing anything — the same shape as
// flood-refusal-platform-wide.test.js, and the only shape that can see a string
// sitting in a JSX attribute on the other side of the repo.
//
// Scope rule, deliberately narrow: only placeholders that are PURELY a numeric
// specimen (`/^[\d\s+\-()]+$/`) are checked. "10-digit mobile number" is prose
// describing the format, not an example of it, and prose cannot be wrong in the
// way a specimen can.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')

const TREES = [
  join(REPO, 'frontend/src'),
  join(REPO, 'mobile/src'),
]

const CODE = new Set(['.js', '.jsx'])

function sourceFiles(dir) {
  if (!existsSync(dir)) return [] // absent in a partial checkout
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
  lines: readFileSync(path, 'utf8').split('\n'),
}))

// `placeholder="…"` and `placeholder={'…'}` / {"…"} — the two forms both
// codebases use. Template literals are skipped: an interpolated placeholder is
// not a fixed specimen and cannot be checked statically.
const PLACEHOLDER = /placeholder=(?:"([^"]*)"|\{\s*['"]([^'"]*)['"]\s*\})/g

// A specimen, not prose: digits and the punctuation people put between them.
const IS_NUMERIC_SPECIMEN = /^[\d\s+\-()]+$/

// How much of the surrounding file to read for context. A placeholder's field
// name is usually on the same line or within a couple of lines of it.
const CONTEXT = 4

function specimens() {
  const found = []
  for (const { path, lines } of FILES) {
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(PLACEHOLDER)) {
        const value = m[1] ?? m[2]
        if (!value || !IS_NUMERIC_SPECIMEN.test(value)) continue
        const context = lines
          .slice(Math.max(0, i - CONTEXT), i + CONTEXT)
          .join('\n')
        found.push({ path, line: i + 1, value, context })
      }
    }
  }
  return found
}

const SPECIMENS = specimens()

// The canonical rules, copied from where each is actually enforced rather than
// imported: frontend/mobile utils are not importable from the backend test run,
// and duplicating the regex here means a change to either side shows up as a
// failure rather than as two files quietly agreeing on the wrong thing.
const PHONE_RE = /^[6-9]\d{9}$/          // users.validation.js
const PINCODE_RE = /^\d{6}$/             // properties.validation.js

const isPhoneField = (ctx) => /phone|mobile|contactNumber|tenantPhone|whatsapp/i.test(ctx)
const isPincodeField = (ctx) => /pincode|pin\s?code|postal/i.test(ctx)

describe('placeholders that demonstrate a format', () => {
  // A canary. If the scan silently stops matching — a refactor to a shared
  // <Field> component, a rename of the prop — every assertion below passes
  // vacuously and this suite becomes decoration.
  it('finds numeric placeholders to check at all', () => {
    expect(SPECIMENS.length).toBeGreaterThan(0)
  })

  it('every phone placeholder passes the phone validator', () => {
    const offenders = SPECIMENS
      .filter((s) => isPhoneField(s.context) && !isPincodeField(s.context))
      .filter((s) => !PHONE_RE.test(s.value))
      .map((s) => `${s.path}:${s.line} → "${s.value}"`)

    // Named in the failure, because the fix is "delete the spaces" and the only
    // hard part is finding which of ~20 files it is in.
    expect(offenders, [
      'A phone placeholder must satisfy /^[6-9]\\d{9}$/ exactly — the server',
      'trims the ends and nothing else, so an internal space or a +91 prefix is',
      'a value the user cannot successfully type. Use 9876543210.',
    ].join(' ')).toEqual([])
  })

  it('every pincode placeholder passes the pincode validator', () => {
    const offenders = SPECIMENS
      .filter((s) => isPincodeField(s.context))
      .filter((s) => !PINCODE_RE.test(s.value))
      .map((s) => `${s.path}:${s.line} → "${s.value}"`)

    expect(offenders, 'A pincode placeholder must satisfy /^\\d{6}$/.').toEqual([])
  })
})
