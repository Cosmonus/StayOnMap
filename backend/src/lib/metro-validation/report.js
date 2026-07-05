import { validateAllNetworks } from './validate.js'

// Baseline entries and current warnings are matched on this key — matches
// backend/data/metro-validation-baseline.json's entry shape exactly.
function baselineKey({ code, city, line, station }) {
  return [code, city, line ?? '', station ?? ''].join('::')
}

// Splits current warnings into `knownWarnings` (matched in the baseline —
// informational, doesn't fail) and `newWarnings` (not in the baseline —
// fails). Also reports `resolvedBaselineEntries` — baseline entries with no
// matching current warning, i.e. someone fixed a previously-known issue —
// so a shrinking baseline is visible, not silent.
export function diffWarningsAgainstBaseline(allWarnings, baseline) {
  const baselineEntries = baseline?.entries ?? []
  const baselineMap = new Map(baselineEntries.map((e) => [baselineKey(e), e]))
  const matchedKeys = new Set()

  const knownWarnings = []
  const newWarnings = []

  for (const w of allWarnings) {
    const key = baselineKey(w)
    if (baselineMap.has(key)) {
      knownWarnings.push(w)
      matchedKeys.add(key)
    } else {
      newWarnings.push(w)
    }
  }

  const resolvedBaselineEntries = baselineEntries.filter((e) => !matchedKeys.has(baselineKey(e)))

  return { knownWarnings, newWarnings, resolvedBaselineEntries }
}

// health score: 100, minus 10 per ERROR, minus 2 per new (un-baselined)
// WARNING, floored at 0. Known/baselined warnings don't affect the score —
// they're accepted, documented limitations, not defects. Simple and
// explicit rather than a hidden formula.
function computeHealthScore(errorCount, newWarningCount) {
  return Math.max(0, 100 - errorCount * 10 - newWarningCount * 2)
}

// The single report-building entry point — used identically by
// backend/scripts/validate-metro-data.mjs (CLI) and
// backend/tests/metro-validation.test.js, so there is exactly one place
// this shape is computed.
export function buildHealthReport(citiesData, baseline = { entries: [] }) {
  const perCityResults = validateAllNetworks(citiesData)
  const citiesByName = new Map(citiesData.map((c) => [c.city, c]))

  const allErrors = perCityResults.flatMap((r) => r.errors)
  const allWarnings = perCityResults.flatMap((r) => r.warnings)
  const { knownWarnings, newWarnings, resolvedBaselineEntries } = diffWarningsAgainstBaseline(allWarnings, baseline)

  const knownSet = new Set(knownWarnings)
  const newSet = new Set(newWarnings)

  const perCity = {}
  let linesChecked = 0
  let stationsChecked = 0

  for (const r of perCityResults) {
    const raw = citiesByName.get(r.city)
    const lineCount = raw?.lines?.length ?? 0
    const stationCount = raw?.stations?.length ?? 0
    linesChecked += lineCount
    stationsChecked += stationCount
    perCity[r.city] = {
      lines: lineCount,
      stations: stationCount,
      errors: r.errors.length,
      newWarnings: r.warnings.filter((w) => newSet.has(w)).length,
      knownWarnings: r.warnings.filter((w) => knownSet.has(w)).length,
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    citiesChecked: citiesData.length,
    linesChecked,
    stationsChecked,
    errors: allErrors,
    newWarnings,
    knownWarnings,
    resolvedBaselineEntries,
    perCity,
    healthScore: computeHealthScore(allErrors.length, newWarnings.length),
  }
}
