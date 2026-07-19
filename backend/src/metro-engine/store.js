// Thin filesystem layer for the engine — every stage reads/writes through
// here so the on-disk layout (paths.js) has exactly one consumer surface.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { SOURCE_DIR, RAW_DIR, CANDIDATE_DIR, COMPARE_DIR } from './paths.js'
import { slugFor } from './constants.js'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf-8'))

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

// ── shipped data ────────────────────────────────────────────────────────────

// Sorted by filename so every consumer sees the same city order — candidate
// diffs and exports must be deterministic run to run.
export function loadShippedCities() {
  return readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(SOURCE_DIR, f)))
}

export function loadShippedCity(city) {
  const file = path.join(SOURCE_DIR, `${slugFor(city)}.json`)
  return existsSync(file) ? readJson(file) : null
}

export function writeShippedCity(network) {
  writeJson(path.join(SOURCE_DIR, `${slugFor(network.city)}.json`), network)
}

// ── pipeline workspace (gitignored) ─────────────────────────────────────────

export function loadRaw(city) {
  const file = path.join(RAW_DIR, `${slugFor(city)}.json`)
  return existsSync(file) ? readJson(file) : null
}

export const writeRaw = (envelope) => writeJson(path.join(RAW_DIR, `${slugFor(envelope.city)}.json`), envelope)

export function loadCandidate(city) {
  const file = path.join(CANDIDATE_DIR, `${slugFor(city)}.json`)
  return existsSync(file) ? readJson(file) : null
}

export const writeCandidate = (network) => writeJson(path.join(CANDIDATE_DIR, `${slugFor(network.city)}.json`), network)

export const writeCandidateLog = (city, kind, log) =>
  writeJson(path.join(CANDIDATE_DIR, `${slugFor(city)}.${kind}-log.json`), log)

export const writeCompareReport = (city, report) => writeJson(path.join(COMPARE_DIR, `${slugFor(city)}.json`), report)

export function loadCompareReport(city) {
  const file = path.join(COMPARE_DIR, `${slugFor(city)}.json`)
  return existsSync(file) ? readJson(file) : null
}

// ── committed engine state ──────────────────────────────────────────────────

export const loadJsonFile = readJson
export const writeJsonFile = writeJson
