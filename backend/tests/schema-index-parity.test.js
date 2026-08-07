/**
 * Every index in the database must be declared in schema.prisma — 2026-08-07
 *
 * THE BUG THIS EXISTS TO PREVENT, which has now happened twice.
 *
 * An index created in raw migration SQL but never declared in `schema.prisma` is
 * invisible to Prisma. `migrate diff` reports it as drift, and the next
 * `migrate dev` or `db push` generates a migration that DROPS it. Nothing warns
 * you; the index simply stops existing and the queries that relied on it get
 * slow, or — in the `text_pattern_ops` case — silently stop using an index at all.
 *
 *   1st time: SpatialContext_geohash_prefix_idx. Caught by hand, fixed by
 *             declaring it with `map:` + `type: BTree`. The schema comment there
 *             documents the trap.
 *   2nd time: Property_possessionStatus_idx, _loanEligible_idx and
 *             _conversionStatus_idx, created by migration 20260726010000 and
 *             undeclared for six weeks. Found 2026-08-07 by running
 *             `prisma migrate diff` against a real database.
 *
 * The lesson generalises past indexes: this repo HAND-WRITES migrations (they
 * carry prose explaining why each change is safe), which is worth keeping — but
 * it means nothing automatically reconciles the SQL with the schema. This test
 * is that reconciliation, and it needs no database to run.
 *
 * It checks BOTH directions, because each is a different failure:
 *   → in migrations, not in schema:  Prisma will eventually drop it
 *   → in schema, not in migrations:  a fresh database never gets it
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const MIGRATIONS = join(ROOT, 'prisma', 'migrations')
const SCHEMA = join(ROOT, 'prisma', 'schema.prisma')

// Statements that change which indexes exist. Matched in ONE pass so they are
// replayed in the order they appear — a migration that drops an index on line 2
// and recreates it on line 47 must end with the index present, and grouping the
// operations by kind gets that exactly backwards. (It did, in the first draft.)
const INDEX_DDL = new RegExp(
  [
    'CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?"(?<created>[^"]+)"\\s+ON\\s+"(?<onTable>[^"]+)"',
    'DROP\\s+INDEX\\s+(?:CONCURRENTLY\\s+)?(?:IF\\s+EXISTS\\s+)?"(?<dropped>[^"]+)"',
    'DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?"(?<droppedTable>[^"]+)"',
    'ALTER\\s+INDEX\\s+"(?<renamedFrom>[^"]+)"\\s+RENAME\\s+TO\\s+"(?<renamedTo>[^"]+)"',
  ].join('|'),
  'gi',
)

/** Replay every migration in order; return the indexes left standing. */
function indexesAfterMigrations() {
  const live = new Map() // index name -> table it sits on

  const dirs = readdirSync(MIGRATIONS)
    .filter((d) => existsSync(join(MIGRATIONS, d, 'migration.sql')))
    .sort() // timestamp-prefixed, so lexical order IS apply order

  for (const dir of dirs) {
    const sql = readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8')
    for (const { groups: g } of sql.matchAll(INDEX_DDL)) {
      if (g.created) live.set(g.created, g.onTable)
      else if (g.dropped) live.delete(g.dropped)
      else if (g.droppedTable) {
        // Dropping a table takes its indexes with it.
        for (const [name, table] of live) if (table === g.droppedTable) live.delete(name)
      } else if (g.renamedFrom) {
        const table = live.get(g.renamedFrom)
        live.delete(g.renamedFrom)
        live.set(g.renamedTo, table)
      }
    }
  }
  return live
}

/**
 * The index names schema.prisma implies.
 *
 * Prisma's own naming: `Model_field_idx` for @@index, `Model_field_key` for
 * @@unique and field-level @unique, joined by `_` for composites — unless an
 * explicit `map:` overrides it.
 */
function indexesDeclaredInSchema() {
  const schema = readFileSync(SCHEMA, 'utf8')
  const declared = new Map() // name -> "Model.@@index([...])" for the failure message

  for (const [, model, body] of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    // Field-level @unique. Anchored to a field line so it cannot pick up
    // @@unique or a stray mention inside a comment.
    for (const [, field] of body.matchAll(/^\s{2}(\w+)\s+\w+[^\n]*?\s@unique/gm)) {
      declared.set(`${model}_${field}_key`, `${model}.${field} @unique`)
    }

    // @@index([...]) / @@unique([...]), each optionally carrying map:.
    for (const [, kind, fields, tail] of body.matchAll(
      /@@(index|unique)\(\[([^\]]*(?:\([^)]*\)[^\]]*)*)\]([^)]*(?:\([^)]*\)[^)]*)*)\)/g,
    )) {
      const suffix = kind === 'index' ? 'idx' : 'key'
      const names = fields
        .split(',')
        // `geohash(ops: raw("text_pattern_ops"))` → `geohash`
        .map((f) => f.trim().replace(/\(.*$/, '').trim())
        .filter(Boolean)
      const mapped = tail?.match(/map:\s*"([^"]+)"/)
      const name = mapped ? mapped[1] : `${model}_${names.join('_')}_${suffix}`
      declared.set(name, `${model} @@${kind}([${names.join(', ')}])`)
    }
  }
  return declared
}

const live = indexesAfterMigrations()
const declared = indexesDeclaredInSchema()

describe('schema ↔ migration index parity', () => {
  it('parses both sides — a silent zero here would make every assertion vacuous', () => {
    expect(live.size).toBeGreaterThan(100)
    expect(declared.size).toBeGreaterThan(100)
  })

  it('declares every index the migrations create — or Prisma will drop it', () => {
    const orphaned = [...live.keys()]
      // Primary keys come from `ALTER TABLE … ADD CONSTRAINT … PRIMARY KEY`, not
      // CREATE INDEX, so they never appear here; belt and braces.
      .filter((name) => !name.endsWith('_pkey'))
      .filter((name) => !declared.has(name))
      .map((name) => `${name}  (on "${live.get(name)}")`)

    expect(orphaned, [
      'These indexes exist in the database but are NOT declared in schema.prisma.',
      'Prisma cannot see them: `migrate diff` calls them drift, and the next',
      '`migrate dev` / `db push` will generate a migration DROPPING them.',
      '',
      'Fix by adding the matching @@index/@@unique to the model (use `map:` if the',
      'name does not follow Model_field_idx). This needs NO new migration — the',
      'indexes already exist on every database that ran the migration creating them.',
    ].join('\n')).toEqual([])
  })

  it('creates every index the schema declares — or a fresh database never gets it', () => {
    const missing = [...declared.keys()]
      .filter((name) => !live.has(name))
      .map((name) => `${name}  (${declared.get(name)})`)

    expect(missing, [
      'These indexes are declared in schema.prisma but no migration creates them.',
      'Existing databases may have them from a `migrate dev` that was never',
      'committed; a FRESH one — a new checkout, a rebuilt staging box — will not,',
      'and the queries that need them will quietly do sequential scans.',
      '',
      'Fix by adding the CREATE INDEX to a new migration.',
    ].join('\n')).toEqual([])
  })
})

describe('the specific regressions this test was written for', () => {
  it('still declares the three SALE indexes raw SQL created (2026-07-26)', () => {
    // Undeclared for six weeks; one `migrate dev` from being dropped.
    for (const field of ['possessionStatus', 'loanEligible', 'conversionStatus']) {
      expect(declared.has(`Property_${field}_idx`), `Property_${field}_idx must stay declared`).toBe(true)
      expect(live.has(`Property_${field}_idx`)).toBe(true)
    }
  })

  it('still has the geohash prefix index, which no default btree can replace', () => {
    // Without text_pattern_ops, `geohash LIKE 'tdr1%'` cannot use an index at
    // all on a non-C collation — every coarse-area query becomes a seq scan.
    const name = 'SpatialContext_geohash_prefix_idx'
    expect(live.has(name)).toBe(true)
    expect(declared.has(name)).toBe(true)
  })
})
