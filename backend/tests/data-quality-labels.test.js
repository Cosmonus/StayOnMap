/**
 * The Data Quality panel names every dataset that files a report.
 *
 * `DataQualityReport` exists to separate "this area is genuinely sparse" from
 * "we failed to fetch it" — a distinction that was previously invisible, since
 * the seeder warned to a terminal nobody kept. The admin panel is where that
 * distinction is read.
 *
 * So the panel drifting is not cosmetic. On 2026-08-10 its label map still
 * named `weather_normals` — a table dropped on 2026-07-20 — and had no entry
 * for roads, water, places or the pincode directory. Four of the six real
 * datasets rendered as raw snake_case keys, in the panel that exists to catch
 * exactly this kind of drift.
 *
 * A seeder is added by writing a script, not by touching the panel, so nothing
 * connects the two but this.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every `dataset: 'x'` a seeder script files a report under. */
function seededDatasets() {
  const dir = join(ROOT, 'scripts')
  const found = new Set()
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.mjs'))) {
    const src = readFileSync(join(dir, f), 'utf8')
    // Only where a report is being WRITTEN — a `where: { dataset }` read would
    // otherwise count as a declaration. Two spellings, because the newer
    // seeders go through the shared `recordQualityReport` helper and the
    // older ones call Prisma directly.
    if (!/recordQualityReport\(|dataQualityReport\.create/.test(src)) continue
    for (const m of src.matchAll(/dataset:\s*'([a-z_]+)'/g)) found.add(m[1])
  }
  return [...found].sort()
}

/** The panel's own label map. */
function labelledDatasets() {
  const src = readFileSync(
    new URL('../../frontend/src/features/admin/components/DataQualityPanel.jsx', import.meta.url),
    'utf8',
  )
  const block = src.split('const DATASET_LABELS = {')[1].split('}')[0]
  return [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort()
}

describe('data quality panel labels', () => {
  it('found the seeders and the labels', () => {
    // Guards both assertions below against a rename making them vacuous.
    expect(seededDatasets().length).toBeGreaterThan(3)
    expect(labelledDatasets().length).toBeGreaterThan(3)
  })

  it('names every dataset a seeder files a report for', () => {
    const unlabelled = seededDatasets().filter((d) => !labelledDatasets().includes(d))
    expect(
      unlabelled,
      `these render as raw snake_case keys in the admin panel:\n${unlabelled.join('\n')}`,
    ).toEqual([])
  })

  it('carries no label for a dataset nothing produces any more', () => {
    const orphans = labelledDatasets().filter((d) => !seededDatasets().includes(d))
    expect(
      orphans,
      `no seeder files these — weather_normals survived here 7 weeks after its table was dropped:\n${orphans.join('\n')}`,
    ).toEqual([])
  })
})
