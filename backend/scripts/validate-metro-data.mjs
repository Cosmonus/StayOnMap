// CLI entry point for the metro-network data validator
// (backend/src/lib/metro-validation/). Reads every backend/src/data/
// metro-lines/*.json file (same dynamic-discovery pattern as
// metro.service.js), builds a health report, and prints it.
//
// Usage:
//   node scripts/validate-metro-data.mjs               — validate against
//     the checked-in baseline (backend/data/metro-validation-baseline.json);
//     exits 1 if there are any ERRORs or new (un-baselined) WARNINGs.
//   node scripts/validate-metro-data.mjs --seed-baseline — (re)writes the
//     baseline file from the CURRENT warning list verbatim. Use this after
//     deliberately fixing a baselined issue (to shrink the baseline) or
//     after confirming a new warning is an accepted, permanent limitation
//     (e.g. a genuine unfixable OSM gap) — never use it to silence a
//     warning you haven't actually looked at.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { buildHealthReport } from '../src/lib/metro-validation/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../src/data/metro-lines')
const BASELINE_PATH = path.join(__dirname, '../data/metro-validation-baseline.json')
const SEED_MODE = process.argv.includes('--seed-baseline')

function loadCitiesData() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(DATA_DIR, f), 'utf-8')))
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { entries: [] }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
}

function printIssue(i) {
  const where = [i.city, i.line, i.station].filter(Boolean).join(' / ')
  console.log(`  [${i.code}] ${where}: ${i.message}`)
}

const citiesData = loadCitiesData()
const baseline = SEED_MODE ? { entries: [] } : loadBaseline()
const report = buildHealthReport(citiesData, baseline)

console.log(`Metro network validation — ${report.generatedAt}`)
console.log(`Cities checked: ${report.citiesChecked}, lines: ${report.linesChecked}, stations: ${report.stationsChecked}`)
console.log(`Health score: ${report.healthScore}/100\n`)

for (const [city, c] of Object.entries(report.perCity)) {
  console.log(`${city}: ${c.lines} lines, ${c.stations} stations — ${c.errors} error(s), ${c.newWarnings} new warning(s), ${c.knownWarnings} known warning(s)`)
}

if (report.errors.length > 0) {
  console.log(`\nERRORS (${report.errors.length}) — must be fixed, cannot be baselined:`)
  report.errors.forEach(printIssue)
}

if (report.newWarnings.length > 0) {
  console.log(`\nNEW WARNINGS (${report.newWarnings.length}) — not in the baseline, fix or intentionally baseline with --seed-baseline:`)
  report.newWarnings.forEach(printIssue)
}

if (report.resolvedBaselineEntries.length > 0) {
  console.log(`\nRESOLVED (${report.resolvedBaselineEntries.length}) — previously-baselined issues no longer reproduced:`)
  report.resolvedBaselineEntries.forEach((e) => console.log(`  [${e.code}] ${[e.city, e.line, e.station].filter(Boolean).join(' / ')}`))
}

if (SEED_MODE) {
  // Baseline is forced empty above, so every current warning lands in
  // `newWarnings` — that's the full current warning list, seeded verbatim.
  const seeded = {
    generatedAt: report.generatedAt,
    note: 'Known, already-reviewed WARNING-tier issues — see .claude/roadmap.md for the metro-validation addendum. ERROR-tier issues are never baselined here.',
    entries: report.newWarnings,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(seeded, null, 2) + '\n')
  console.log(`\nSeeded ${seeded.entries.length} baseline entries to ${BASELINE_PATH}`)
  process.exit(0)
}

console.log(`\nKnown (baselined) warnings: ${report.knownWarnings.length} — informational, not blocking.`)

if (report.errors.length > 0 || report.newWarnings.length > 0) {
  console.log('\nFAILED — see ERRORS/NEW WARNINGS above.')
  process.exit(1)
}

console.log('\nOK — no errors, no new warnings.')
process.exit(0)
