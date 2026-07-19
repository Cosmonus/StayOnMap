// Declarative curation — the ONLY place human knowledge about a city's
// network lives. Facts the pipeline cannot derive from OSM tags (a phase-2
// relation with no lifecycle tag, a system tagged outside the metro tag net,
// a duplicate station name needing disambiguation) are recorded here as
// rules with an id and a reason, never as code. Every applied rule id is
// stamped into the candidate's meta.curationApplied so a shipped file is
// traceable back to exactly which human facts shaped it.
import { existsSync } from 'fs'
import { CURATION_FILE } from './paths.js'
import { loadJsonFile } from './store.js'

const EMPTY_CITY = Object.freeze({
  excludeRelations: [],
  excludeNamePatterns: [],
  includeRelations: [],
  renameLines: [],
  renameStations: [],
})

export function loadCuration() {
  return existsSync(CURATION_FILE) ? loadJsonFile(CURATION_FILE) : { version: 1, cities: {} }
}

export function cityCuration(curation, city) {
  return { ...EMPTY_CITY, ...(curation.cities?.[city] ?? {}) }
}
