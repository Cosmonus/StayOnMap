// The QA report — the "Metro QA Dashboard" as a generated artifact. Extends
// the validation lib's buildHealthReport with per-city verdicts and
// plain-language summaries; the CLI renders it and writes JSON (+ markdown,
// which stays local — the repo gitignores *.md by design).
import { buildHealthReport } from '../lib/metro-validation/index.js'

function verdictFor(cityReport) {
  if (cityReport.errors > 0) return 'errors'
  if (cityReport.newWarnings > 0) return 'warnings'
  return 'valid'
}

const VERDICT_ICON = { valid: '✅', warnings: '⚠', errors: '❌' }

export function buildQaReport(citiesData, baseline, compareReports = []) {
  const health = buildHealthReport(citiesData, baseline)
  const compareByCity = new Map(compareReports.map((r) => [r.city, r]))

  const cities = Object.entries(health.perCity).map(([city, report]) => {
    const verdict = verdictFor(report)
    const cityData = citiesData.find((c) => c.city === city)
    const compare = compareByCity.get(city) ?? null
    const bits = [
      `${report.lines} route${report.lines === 1 ? '' : 's'}`,
      `${report.stations} station${report.stations === 1 ? '' : 's'}`,
      `${report.errors} error${report.errors === 1 ? '' : 's'}`,
      report.newWarnings ? `${report.newWarnings} NEW warning${report.newWarnings === 1 ? '' : 's'}` : null,
      report.knownWarnings ? `${report.knownWarnings} known warning${report.knownWarnings === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    return {
      city,
      verdict,
      ...report,
      meta: cityData?.meta ?? null,
      gate: compare?.gate ?? null,
      summary: `${city} ${VERDICT_ICON[verdict]} ${verdict === 'valid' ? 'Valid' : verdict === 'warnings' ? 'Warning' : 'INVALID'}, ${bits.join(', ')}`,
    }
  })

  return {
    generatedAt: health.generatedAt,
    healthScore: health.healthScore,
    citiesChecked: health.citiesChecked,
    linesChecked: health.linesChecked,
    stationsChecked: health.stationsChecked,
    newWarningCount: health.newWarnings.length,
    knownWarningCount: health.knownWarnings.length,
    resolvedBaselineCount: health.resolvedBaselineEntries.length,
    cities,
  }
}

export function renderQaMarkdown(report) {
  const lines = [
    '# Metro Network QA Report',
    '',
    `Generated ${report.generatedAt} — health score **${report.healthScore}/100** across ${report.citiesChecked} cities, ${report.linesChecked} lines, ${report.stationsChecked} stations.`,
    '',
  ]
  for (const city of report.cities) {
    lines.push(`## ${city.summary}`)
    if (city.meta?.source) {
      lines.push('', `- Source: ${city.meta.source}, OSM data ${city.meta.osmDataTimestamp ?? 'unknown'}, engine v${city.meta.engineVersion}`)
      if (city.meta.curationApplied?.length) lines.push(`- Curation applied: ${city.meta.curationApplied.join(', ')}`)
      if (city.meta.excludedRelations?.length) {
        lines.push(`- Excluded relations (${city.meta.excludedRelations.length}):`)
        for (const ex of city.meta.excludedRelations) lines.push(`  - ${ex.id} "${ex.name}" — ${ex.reason}`)
      }
    } else {
      lines.push('', '- Source: pre-engine hand-curated data (no meta block yet)')
    }
    lines.push('')
  }
  return lines.join('\n')
}
