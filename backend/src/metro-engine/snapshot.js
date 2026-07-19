// Structure snapshot: the per-city line/station counts CI holds the shipped
// data to. Replaces the EXPECTED_CITY_COUNTS object that used to be hardcoded
// inside tests/metro-validation.test.js — the test now reads the committed
// snapshot file, so a promotion updates data + snapshot together instead of
// editing test source. Any un-promoted data change still fails the suite.
import { existsSync } from 'fs'
import { SNAPSHOT_FILE } from './paths.js'
import { loadShippedCities, loadJsonFile, writeJsonFile } from './store.js'

export function buildStructureSnapshot(citiesData) {
  const cities = {}
  for (const data of citiesData) {
    cities[data.city] = { lines: data.lines.length, stations: data.stations.length }
  }
  return { generatedAt: new Date().toISOString(), cities }
}

export const loadStructureSnapshot = () => (existsSync(SNAPSHOT_FILE) ? loadJsonFile(SNAPSHOT_FILE) : null)

export function writeStructureSnapshot() {
  const snapshot = buildStructureSnapshot(loadShippedCities())
  writeJsonFile(SNAPSHOT_FILE, snapshot)
  return snapshot
}
