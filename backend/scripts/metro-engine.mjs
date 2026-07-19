#!/usr/bin/env node
// Metro Data Engine CLI — the one entry point for the ingest → parse →
// repair → validate → compare → promote → export pipeline that replaced
// hand-editing backend/src/data/metro-lines/*.json.
//
//   node scripts/metro-engine.mjs <command> [--city Delhi] [--confirm] [...]
//
// Destructive commands are dry-run by default and require --confirm, matching
// scripts/dedupe-metro-paths.mjs / fetch-osm-pois.mjs precedent. Shipped data
// is only ever written by `promote`, and promote is gated: candidate must
// validate with 0 errors and no more warnings than the currently-shipped
// data — there is deliberately no --force; the escape hatch is a curation
// rule or a baselined warning, both reviewable data.
import { runExport } from '../src/metro-engine/export/geojson.js'
import { buildStructureSnapshot, writeStructureSnapshot } from '../src/metro-engine/snapshot.js'
import { loadShippedCities } from '../src/metro-engine/store.js'
import { SNAPSHOT_FILE, RAW_DIR } from '../src/metro-engine/paths.js'
import { fetchCity, ingestFromFile } from '../src/metro-engine/import/fetch.js'
import { parseCity } from '../src/metro-engine/parse/parse.js'
import {
  loadRaw, writeCandidate, writeCandidateLog, loadCandidate,
  loadShippedCity, writeShippedCity, writeCompareReport, loadCompareReport,
  loadJsonFile, writeJsonFile,
} from '../src/metro-engine/store.js'
import { repairNetwork } from '../src/metro-engine/repair/repair.js'
import { compareNetworks } from '../src/metro-engine/compare/compare.js'
import { buildQaReport, renderQaMarkdown } from '../src/metro-engine/qa.js'
import { withSegments } from '../src/metro-engine/export/segments.js'
import { buildHealthReport, validateNetwork } from '../src/lib/metro-validation/index.js'
import { BASELINE_FILE, QA_REPORT_FILE, QA_REPORT_MD_FILE } from '../src/metro-engine/paths.js'
import { writeFileSync } from 'fs'
import { bboxFor, buildMetroQuery } from '../src/metro-engine/import/query.js'
import { loadCuration, cityCuration } from '../src/metro-engine/curation.js'
import { CITY_CENTERS } from '../src/config/cityCenters.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One city when --city is passed (validated), all supported cities otherwise.
function targetCities() {
  if (!cli.city) return Object.keys(CITY_CENTERS)
  if (!CITY_CENTERS[cli.city]) {
    console.error(`Unknown city: ${cli.city}. Known: ${Object.keys(CITY_CENTERS).join(', ')}`)
    process.exit(1)
  }
  return [cli.city]
}

const args = process.argv.slice(2)
const command = args[0] && !args[0].startsWith('--') ? args[0] : null

const flag = (name) => args.includes(`--${name}`)
// Read the value only when the flag is actually present — `indexOf` returns
// -1 when absent and args[0] would be misread as the value (same bug class
// fetch-osm-pois.mjs fixed).
function flagValue(name) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null
}

export const cli = {
  confirm: flag('confirm'),
  md: flag('md'),
  candidates: flag('candidates'),
  city: flagValue('city'),
  endpoint: flagValue('endpoint'),
  fromFile: flagValue('from-file'),
}

const COMMANDS = {
  fetch: {
    help: 'fetch raw OSM metro data into the cache (--confirm to hit Overpass; --from-file <path> with --city to ingest a manual download)',
    async run() {
      const curation = loadCuration()

      if (cli.fromFile) {
        if (!cli.city) {
          console.error('--from-file needs --city <Name> so the export is cached under the right city')
          process.exit(1)
        }
        const env = ingestFromFile(cli.city, cli.fromFile)
        return console.log(`${cli.city}: ingested ${env.elements.length} elements from ${cli.fromFile}`)
      }

      const cities = targetCities()
      if (!cli.confirm) {
        console.log(`DRY RUN — would fetch ${cities.join(', ')} into ${RAW_DIR}\n`)
        const example = cities[0]
        const ids = cityCuration(curation, example).includeRelations.map((r) => r.id)
        console.log(`Example query (${example}) — runnable as-is at overpass-turbo.eu for --from-file:\n`)
        console.log(buildMetroQuery(bboxFor(CITY_CENTERS[example]), ids))
        return console.log('\nPass --confirm to fetch.')
      }

      let failed = 0
      for (const [i, city] of cities.entries()) {
        const ids = cityCuration(curation, city).includeRelations.map((r) => r.id)
        try {
          const env = await fetchCity(city, { endpoint: cli.endpoint, includeRelationIds: ids })
          console.log(`${city}: ${env.elements.length} elements via ${env.endpoint} (${env.elapsedMs}ms, OSM data ${env.osmDataTimestamp ?? 'unknown'})`)
        } catch (err) {
          failed++
          console.warn(`${city}: FAILED — ${err.message}`)
        }
        // Overpass runs on donated hardware; a pause between cities is the
        // cost of being allowed to keep using it.
        if (i < cities.length - 1) await sleep(2_000)
      }
      if (failed) {
        console.warn(`\n⚠ ${failed} cities failed — they keep their current shipped data; re-run fetch later or use --from-file`)
        process.exit(1)
      }
    },
  },
  parse: {
    help: 'parse cached raw OSM data into candidate networks (offline; always writable — candidates are workspace, not shipped data)',
    run() {
      const curation = loadCuration()
      for (const city of targetCities()) {
        const raw = loadRaw(city)
        if (!raw) { console.warn(`${city}: no raw cache — run fetch first (skipped)`); continue }
        const { candidate, parseLog } = parseCity(raw, curation)
        writeCandidate(candidate)
        writeCandidateLog(city, 'parse', parseLog)
        const excluded = parseLog.excludedRelations.length
        console.log(`${city}: ${candidate.lines.length} lines, ${candidate.stations.length} stations` +
          ` (${parseLog.routeRelations} route relations, ${excluded} excluded${parseLog.unnamedStopCount ? `, ${parseLog.unnamedStopCount} unnamed stops dropped` : ''})`)
        for (const ex of parseLog.excludedRelations) {
          console.log(`    excluded ${ex.id} "${ex.name}" — ${ex.reason}`)
        }
        for (const line of parseLog.lines) {
          const notes = []
          if (line.components > 1) notes.push(`${line.components} components`)
          if (line.stationMethod !== 'relation-roles') notes.push(`stations via ${line.stationMethod}`)
          console.log(`    ${line.name} (${line.variants} variant${line.variants === 1 ? '' : 's'})${notes.length ? ` — ${notes.join(', ')}` : ''}`)
        }
      }
    },
  },
  repair: {
    help: 'apply deterministic repairs to candidates in place (idempotent; logs every change)',
    run() {
      const curation = loadCuration()
      for (const city of targetCities()) {
        const candidate = loadCandidate(city)
        if (!candidate) { console.warn(`${city}: no candidate — run parse first (skipped)`); continue }
        const { network, log } = repairNetwork(candidate, curation)
        writeCandidate(network)
        writeCandidateLog(city, 'repair', log)
        console.log(`${city}: ${log.changes.length} change(s) → ${network.lines.length} lines, ${network.stations.length} stations`)
        for (const c of log.changes) {
          const { op, ...detail } = c
          console.log(`    ${op}: ${JSON.stringify(detail)}`)
        }
      }
    },
  },
  validate: {
    help: 'validate shipped data against the baseline (or candidates with --candidates); exit 1 on errors/new warnings',
    run() {
      if (cli.candidates) {
        let failed = 0
        for (const city of targetCities()) {
          const candidate = loadCandidate(city)
          if (!candidate) { console.warn(`${city}: no candidate (skipped)`); continue }
          const { errors, warnings } = validateNetwork(candidate)
          console.log(`${city}: ${errors.length} error(s), ${warnings.length} warning(s)`)
          for (const e of errors) { console.log(`    ERROR ${e.code}: ${e.message}`); failed++ }
        }
        if (failed) process.exit(1)
        return
      }
      const report = buildHealthReport(loadShippedCities(), loadJsonFile(BASELINE_FILE))
      for (const [city, r] of Object.entries(report.perCity)) {
        console.log(`${city}: ${r.errors} error(s), ${r.newWarnings} new / ${r.knownWarnings} known warning(s)`)
      }
      console.log(`Health score: ${report.healthScore}/100`)
      if (report.errors.length || report.newWarnings.length) process.exit(1)
    },
  },
  compare: {
    help: 'diff candidates against shipped data and compute the promotion gate',
    run() {
      for (const city of targetCities()) {
        const candidate = loadCandidate(city)
        const shipped = loadShippedCity(city)
        if (!candidate || !shipped) { console.warn(`${city}: missing ${candidate ? 'shipped file' : 'candidate'} (skipped)`); continue }
        const report = compareNetworks(candidate, shipped)
        writeCompareReport(city, report)
        printCompare(report)
      }
    },
  },
  promote: {
    help: 'replace a city\'s shipped data with its candidate — gated, per-city, --city and --confirm required',
    run() {
      if (!cli.city) { console.error('promote requires --city <Name>'); process.exit(1) }
      const city = targetCities()[0]

      // Re-derive from the raw cache so what gets shipped is exactly what the
      // pipeline produces today — never a hand-tweaked candidate file.
      const raw = loadRaw(city)
      if (!raw) { console.error(`${city}: no raw cache — run fetch first`); process.exit(1) }
      const curation = loadCuration()
      const { candidate, parseLog } = parseCity(raw, curation)
      const { network, log: repairLog } = repairNetwork(candidate, curation)
      const shipped = loadShippedCity(city)
      if (!shipped) { console.error(`${city}: no shipped file to replace`); process.exit(1) }
      const report = compareNetworks(network, shipped)
      writeCandidate(network)
      writeCandidateLog(city, 'parse', parseLog)
      writeCandidateLog(city, 'repair', repairLog)
      writeCompareReport(city, report)
      printCompare(report)

      if (!report.gate.pass) {
        console.error(`\n✗ Gate FAILED — not promoting. Fix via curation rules or baseline the warnings, then re-run.`)
        process.exit(1)
      }
      if (!cli.confirm) return console.log('\nDry run — gate passes. Re-run with --confirm to promote.')

      writeShippedCity(withSegments(network))

      // Per-city surgical baseline reseed: other cities' entries untouched;
      // this city's entries become exactly its current warnings.
      const baseline = loadJsonFile(BASELINE_FILE)
      const others = baseline.entries.filter((e) => e.city !== city)
      const cityWarnings = validateNetwork(network).warnings.map(({ severity, code, city: c, line, station, message }) => {
        const entry = { severity, code, city: c, message }
        if (line !== undefined) entry.line = line
        if (station !== undefined) entry.station = station
        return entry
      })
      writeJsonFile(BASELINE_FILE, {
        ...baseline,
        generatedAt: new Date().toISOString(),
        entries: [...others, ...cityWarnings],
      })

      const { featureCount } = runExport()
      writeStructureSnapshot()
      console.log(`\n✓ Promoted ${city}: shipped file, frontend GeoJSON (${featureCount} features), baseline (${cityWarnings.length} entries for ${city}), structure snapshot all updated. Run the test suite before committing.`)
    },
  },
  qa: {
    help: 'generate the QA report (metro-qa-report.json; --md also renders markdown) from shipped data',
    run() {
      const compareReports = targetCities().map((city) => loadCompareReport(city)).filter(Boolean)
      const report = buildQaReport(loadShippedCities(), loadJsonFile(BASELINE_FILE), compareReports)
      for (const city of report.cities) console.log(city.summary)
      console.log(`\nHealth score ${report.healthScore}/100 — ${report.citiesChecked} cities, ${report.linesChecked} lines, ${report.stationsChecked} stations`)
      writeJsonFile(QA_REPORT_FILE, report)
      console.log(`Wrote ${QA_REPORT_FILE}`)
      if (cli.md) {
        writeFileSync(QA_REPORT_MD_FILE, renderQaMarkdown(report))
        console.log(`Wrote ${QA_REPORT_MD_FILE} (local only — the repo gitignores *.md)`)
      }
    },
  },
  pipeline: {
    help: 'fetch → parse → repair → validate → compare for the targeted cities; never promotes',
    async run() {
      for (const step of ['fetch', 'parse', 'repair', 'compare']) {
        console.log(`\n── ${step} ──`)
        if (step === 'fetch' && !cli.confirm) { console.log('(skipped — pass --confirm to hit Overpass; using existing raw caches)'); continue }
        await COMMANDS[step].run()
      }
    },
  },
  export: {
    help: 'regenerate frontend GeoJSON (+ it-corridors copy) from shipped source files',
    run() {
      const { featureCount, outFile } = runExport()
      console.log(`Wrote ${featureCount} features to ${outFile}`)
    },
  },
  snapshot: {
    help: 'update the per-city line/station count snapshot CI holds shipped data to (--confirm to write)',
    run() {
      const snapshot = buildStructureSnapshot(loadShippedCities())
      for (const [city, counts] of Object.entries(snapshot.cities)) {
        console.log(`  ${city.padEnd(10)} ${counts.lines} lines, ${counts.stations} stations`)
      }
      if (!cli.confirm) return console.log(`\nDry run — pass --confirm to write ${SNAPSHOT_FILE}`)
      writeStructureSnapshot()
      console.log(`\nWrote ${SNAPSHOT_FILE}`)
    },
  },
}

function printCompare(report) {
  const { lines, stations, validation, gate } = report
  console.log(`\n${report.city} — candidate vs shipped (OSM data ${report.osmDataTimestamp ?? 'unknown'})`)
  console.log(`  lines: ${lines.matched} matched, ${lines.added.length} added, ${lines.removed.length} removed, ${lines.renamed.length} renamed`)
  for (const name of lines.added) console.log(`    + ${name}`)
  for (const name of lines.removed) console.log(`    - ${name}`)
  for (const r of lines.renamed) console.log(`    ~ "${r.from}" → "${r.to}"`)
  for (const d of lines.geometryDeltas) console.log(`    Δ ${d.line}: ${d.lengthDeltaMeters > 0 ? '+' : ''}${d.lengthDeltaMeters}m (${d.lengthDeltaPct ?? '?'}%), ${d.pointCountDelta > 0 ? '+' : ''}${d.pointCountDelta} points`)
  console.log(`  stations: ${stations.matched} matched, ${stations.added.length} added, ${stations.removed.length} removed, ${stations.moved.length} moved >50m`)
  for (const name of stations.added) console.log(`    + ${name}`)
  for (const name of stations.removed) console.log(`    - ${name}`)
  for (const m of stations.moved) console.log(`    ↔ ${m.name} (${m.meters}m)`)
  console.log(`  validation: candidate ${validation.candidateErrors} errors / ${validation.candidateWarnings} warnings; shipped ${validation.shippedWarnings} warnings`)
  for (const e of validation.candidateErrorList) console.log(`    ERROR ${e.code}: ${e.message}`)
  console.log(`  gate: ${gate.pass ? '✓ PASS' : `✗ FAIL — ${gate.reasons.join('; ')}`}`)
}

function help() {
  console.log('Metro Data Engine\n\nUsage: node scripts/metro-engine.mjs <command> [flags]\n\nCommands:')
  for (const [name, { help }] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(10)} ${help}`)
  }
  console.log('\nFlags: --city <Name>  --confirm  --md  --candidates  --endpoint <url>  --from-file <path>')
}

async function main() {
  if (!command || command === 'help') return help()
  const entry = COMMANDS[command]
  if (!entry) {
    console.error(`Unknown command: ${command}\n`)
    help()
    process.exit(1)
  }
  await entry.run()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
