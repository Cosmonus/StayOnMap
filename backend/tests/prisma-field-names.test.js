/**
 * Every field named in a `select` is a field the model actually has.
 *
 * This is the only kind of test that catches the bug class it exists for,
 * because the failure NEVER LOOKS LIKE A FAILURE:
 *
 *   admin.service.js  `awardPoints(review.authorId, 'REVIEW_APPROVED', …)` —
 *                     CommunityReview's column is `reviewerId`. The read was
 *                     `undefined`, awardPoints no-opped, and the surrounding
 *                     fire-and-forget `.catch()` ate it. The largest award in
 *                     the ledger (80 points) had never once been paid.
 *   graph/tools.js    `select: { …, createdAt: true }` on FraudSignal, whose
 *                     column is `detectedAt`. Prisma threw
 *                     PrismaClientValidationError, `runTool` mapped it to
 *                     TOOL_FAILED, and `getPropertyTrustSignals` had therefore
 *                     failed 100% of the time since it was written.
 *   seo               `listingVisibility` filtered on Property (it lives on
 *                     User) — the one that 500'd the sitemap for a day, and the
 *                     reason seo-prerender.test.js already parses the schema.
 *
 * A unit test cannot see any of these: the Prisma client is mocked, so a mock
 * happily returns whatever a wrong field name asks for. Only the schema knows.
 *
 * SCOPE, deliberately narrow: top-level `select` blocks on an identifiable
 * `prisma.<model>.<method>({ … })` call. Not `where` (operators, relation
 * filters and JSON paths make it a different problem) and not nested relation
 * selects. Both bugs above were in scope; widening this is worth doing only
 * when a real bug escapes it.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── The schema, as { modelName: Set<fieldName> } ────────────────────────────
function readModels() {
  const src = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
  const models = new Map()
  for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields = new Set()
    for (const line of m[2].split('\n')) {
      const field = /^\s{2,}(\w+)\s+\S/.exec(line)         // "  name  String"
      if (field && !line.trimStart().startsWith('@@')) fields.add(field[1])
    }
    models.set(m[1], fields)
  }
  return models
}

const MODELS = readModels()

/** `prisma.communityReview` → `CommunityReview`. */
function modelFor(accessor) {
  const name = accessor[0].toUpperCase() + accessor.slice(1)
  return MODELS.has(name) ? name : null
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return e.name.endsWith('.js') ? [p] : []
})

/** The `{ … }` starting at `open`, brace-matched. */
function block(src, open) {
  let depth = 0
  let i = open
  do {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  } while (i < src.length && depth > 0)
  return src.slice(open, i)
}

/**
 * Keys at depth 1 of an object literal. `{ a: true, rel: { select: {…} } }`
 * yields ['a', 'rel'] — the relation name is checked, its children are not.
 *
 * Comments are stripped first. These blocks are heavily commented, and prose
 * contains colons: a line reading "Nullable: an owner with no listings…" parses
 * as a field named `Nullable` and fails the run on a sentence.
 */
function topLevelKeys(src) {
  const objSrc = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const keys = []
  let depth = 0
  for (let i = 0; i < objSrc.length; i++) {
    const c = objSrc[i]
    if (c === '{' || c === '[') { depth++; continue }
    if (c === '}' || c === ']') { depth--; continue }
    if (depth !== 1) continue
    const key = /^(\w+)\s*:/.exec(objSrc.slice(i))
    if (key && !/[\w$]/.test(objSrc[i - 1] ?? '')) {
      keys.push(key[1])
      i += key[0].length - 1
    }
  }
  return keys
}

/** Every (file, model, field) a top-level `select` names. */
function selectedFields() {
  const out = []
  for (const file of walk(join(ROOT, 'src'))) {
    const src = readFileSync(file, 'utf8')
    for (const call of src.matchAll(/\bprisma\.(\w+)\.\w+\(\s*\{/g)) {
      const model = modelFor(call[1])
      if (!model) continue

      const args = block(src, src.indexOf('{', call.index + call[0].length - 1))
      // Only a `select` at depth 1 of the argument object — a nested one
      // belongs to a relation and is a different model's business.
      let depth = 0
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '{') { depth++; continue }
        if (args[i] === '}') { depth--; continue }
        if (depth !== 1 || !args.startsWith('select', i)) continue
        const open = args.indexOf('{', i)
        if (open === -1 || !/^select\s*:\s*$/.test(args.slice(i, open))) continue
        for (const field of topLevelKeys(block(args, open))) {
          out.push({ file: file.replace(ROOT, '').replace(/\\/g, '/'), model, field })
        }
        break
      }
    }
  }
  return out
}

describe('the schema parser', () => {
  it('found the models', () => {
    // Guards every assertion below: an empty map would make them all vacuous.
    expect(MODELS.size).toBeGreaterThan(50)
    expect([...MODELS.get('CommunityReview')]).toContain('reviewerId')
    expect([...MODELS.get('FraudSignal')]).toContain('detectedAt')
    expect([...MODELS.get('FraudSignal')]).not.toContain('createdAt')
  })

  it('found selects to check', () => {
    expect(selectedFields().length).toBeGreaterThan(100)
  })
})

// Prisma's own aggregate selector. Real, and deliberately not in the schema.
const NOT_SCHEMA_FIELDS = new Set(['_count'])

describe('prisma selects', () => {
  it('name only fields the model has', () => {
    const unknown = selectedFields()
      .filter(({ model, field }) => !MODELS.get(model).has(field) && !NOT_SCHEMA_FIELDS.has(field))
      .map(({ file, model, field }) => `${file} → prisma.${model}: "${field}"`)

    expect(
      unknown,
      `these throw PrismaClientValidationError at runtime:\n${unknown.join('\n')}`,
    ).toEqual([])
  })
})
