/**
 * Enum → UI config parity, across both platforms.
 *
 * A whole class of bug lives here and every instance of it is SILENT. The
 * server sends an enum value; the client looks it up in a hand-written table;
 * the table has no entry for it. Nothing throws, nothing logs, and what the
 * user gets depends entirely on how that particular lookup was written:
 *
 *   TrustBadge          `if (!cfg) return null`   → the badge is BLANK SPACE
 *   PropertyStatusPill  `?? FALLBACK`             → the pill says "Unknown"
 *   STATUS_COPY         `?? { label: c.status }`  → our internal vocabulary is
 *                                                   printed at the user, which
 *                                                   .claude/support.md
 *                                                   explicitly forbids
 *
 * The first is the one `.claude/architecture.md` has warned about in prose for
 * months — "UI configs must cover all 8 — a missing entry silently renders
 * nothing" — with nothing enforcing it. A doc cannot fail a build.
 *
 * Lives in backend/tests because that is where the schema is and where the
 * other cross-platform parity checks already live (legal-parity,
 * wizard-steps-parity, amenities). Adding a config is one row in TABLES.
 *
 * What this does NOT check: that the labels are *good*, or that the colours
 * mean anything. Only that no value the database can produce arrives at a
 * lookup with nothing behind it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8')
const SCHEMA = read('backend', 'prisma', 'schema.prisma')

/** The values of a Prisma enum, read from the schema — never transcribed. */
function enumValues(name) {
  const start = SCHEMA.indexOf(`enum ${name} {`)
  if (start < 0) return null
  return SCHEMA.slice(start).split('}')[0]
    .split('\n').slice(1)
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l))
}

// Comments and string bodies are stripped before keys are read, so a
// commented-out entry does not count as present and a colon inside a Tailwind
// class ("hover:bg-red-50") is not mistaken for one.
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/'[^'\n]*'/g, "''")
  .replace(/"[^"\n]*"/g, '""')
  .replace(/`[^`]*`/g, '``')

/**
 * Top-level keys of one object literal.
 *
 * Brace-matched rather than line-matched, and NESTED contents are dropped —
 * otherwise a config whose values are themselves objects reports its inner
 * keys as if they were entries, and a genuinely missing enum value hides
 * behind a sibling's internals.
 */
function configKeys(src, name) {
  const clean = strip(src)
  const opener = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\{`).exec(clean)
  if (!opener) return null

  let depth = 1
  let body = ''
  for (let i = opener.index + opener[0].length; i < clean.length && depth > 0; i++) {
    const c = clean[i]
    if (c === '{' || c === '[') { depth++; continue }
    if (c === '}' || c === ']') { depth--; continue }
    if (depth === 1) body += c
  }

  return [...body.matchAll(/([A-Z][A-Z0-9_]*)\s*:/g)].map((m) => m[1])
}

// enum · file · const · what a missing entry actually looks like on screen.
// The last column is the point: it is why each row is worth a test, and it is
// the sentence somebody will read when this fails.
const TABLES = [
  ['TrustBadge', 'frontend/src/components/common/TrustBadge.jsx', 'BADGE_CONFIG',
    'the badge renders as blank space'],
  ['TrustBadge', 'mobile/src/components/common/TrustBadge.js', 'BADGE_CONFIG',
    'the badge renders as blank space'],
  ['TrustBadge', 'mobile/src/components/common/TrustBadge.js', 'BADGE_ICON',
    'the badge shows the wrong icon — it falls back to a tick'],

  ['PropertyStatus', 'frontend/src/components/common/PropertyStatusPill.jsx', 'PROPERTY_STATUS_CONFIG',
    'the pill says "Unknown"'],

  ['SupportCaseStatus', 'frontend/src/features/support/components/supportCopy.js', 'STATUS_COPY',
    'a user is shown our queue\'s internal word for it'],
  ['SupportCaseStatus', 'mobile/src/features/support/supportCopy.js', 'STATUS_COPY',
    'a user is shown our queue\'s internal word for it'],
  ['SupportCaseType', 'frontend/src/features/support/components/supportCopy.js', 'CATEGORY_LABEL',
    'a user is shown the raw enum as a category'],
  ['SupportCaseType', 'mobile/src/features/support/supportCopy.js', 'CATEGORY_LABEL',
    'a user is shown the raw enum as a category'],

  ['SupportCaseStatus', 'frontend/src/features/admin/components/support/supportVocab.js', 'STATUS_LABEL',
    'the queue shows a raw enum'],
  ['SupportCaseStatus', 'frontend/src/features/admin/components/support/supportVocab.js', 'STATUS_PILL',
    'the pill loses its colour and reads as neutral'],
  ['SupportCaseType', 'frontend/src/features/admin/components/support/supportVocab.js', 'TYPE_LABEL',
    'the queue shows a raw enum'],
  ['SupportPriority', 'frontend/src/features/admin/components/support/supportVocab.js', 'PRIORITY_LABEL',
    'the queue shows a raw enum'],
  ['SupportPriority', 'frontend/src/features/admin/components/support/supportVocab.js', 'PRIORITY_PILL',
    'an URGENT case is not coloured as one'],
  ['SupportVisibility', 'frontend/src/features/admin/components/support/supportVocab.js', 'VISIBILITY_LABEL',
    'a moderator cannot tell who can read a message'],
  ['SupportVisibility', 'frontend/src/features/admin/components/support/supportVocab.js', 'MESSAGE_TONE',
    'an INTERNAL note is not tinted as internal — the dangerous one'],

  // Two SERVER-side tables. They are here for the same reason as the client
  // ones — a missing key reaches a moderator as a raw enum name — and they are
  // on the server precisely so there is only one of each to keep complete.
  ['FraudSignalType', 'backend/src/features/intelligence/signalLabels.js', 'FRAUD_SIGNAL_LABELS',
    'moderation is shown the raw enum as the reason a listing is risky'],
]

describe('the harness itself', () => {
  // Every assertion below is `for (value of values)`, so an empty list would
  // pass vacuously. These two are the ones that would let that happen.
  it('can read an enum out of the schema', () => {
    expect(enumValues('TrustBadge')).toHaveLength(8)
    expect(enumValues('PropertyStatus')).toContain('OCCUPIED')
  })

  it('reads only TOP-LEVEL keys, not a nested value’s own', () => {
    const src = "const X = { ALPHA: { BETA: 1 }, GAMMA: 'x' }"
    expect(configKeys(src, 'X')).toEqual(['ALPHA', 'GAMMA'])
  })

  it('does not count a commented-out entry as present', () => {
    const src = 'const X = {\n  ALPHA: 1,\n  // BETA: 2,\n}'
    expect(configKeys(src, 'X')).toEqual(['ALPHA'])
  })

  it('is not fooled by a colon inside a class string', () => {
    const src = "const X = { ALPHA: 'hover:bg-red-50 focus:RING' }"
    expect(configKeys(src, 'X')).toEqual(['ALPHA'])
  })
})

describe('every enum value has a UI entry', () => {
  for (const [enumName, file, constName, symptom] of TABLES) {
    it(`${enumName} → ${constName} (${file.split('/')[0]})`, () => {
      const values = enumValues(enumName)
      expect(values, `enum ${enumName} not found in schema.prisma`).toBeTruthy()
      expect(values.length).toBeGreaterThan(1)

      const keys = configKeys(read(file), constName)
      expect(keys, `${constName} not found in ${file}`).toBeTruthy()

      const missing = values.filter((v) => !keys.includes(v))
      expect(missing, `${missing.join(', ')} → ${symptom}`).toEqual([])
    })
  }

  it('covers both platforms wherever a config exists twice', () => {
    // The asymmetric case is the one that gets missed: web gains a value and
    // mobile does not, and only the phone is wrong.
    const byConst = TABLES.reduce((acc, [, file, constName]) => {
      acc[constName] = acc[constName] ?? new Set()
      acc[constName].add(file.split('/')[0])
      return acc
    }, {})
    for (const shared of ['BADGE_CONFIG', 'STATUS_COPY', 'CATEGORY_LABEL']) {
      expect([...byConst[shared]].sort(), shared).toEqual(['frontend', 'mobile'])
    }
  })
})
