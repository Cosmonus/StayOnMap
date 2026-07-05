import { deriveNetworkGraph } from './graph.js'
import { ERROR_RULES, WARNING_RULES, checkRequiredTopLevelFields } from './rules.js'

// Validates one city's parsed metro-lines JSON. Returns
// `{ errors: Issue[], warnings: Issue[] }`. If the data is too malformed to
// safely run geometry checks against (missing lines/stations arrays etc.),
// only the structural errors are returned — the rest would likely throw or
// produce meaningless results against malformed input.
export function validateNetwork(cityData) {
  const structuralErrors = checkRequiredTopLevelFields(cityData)
  if (structuralErrors.length > 0) {
    return { errors: structuralErrors, warnings: [] }
  }

  const graph = deriveNetworkGraph(cityData)
  const ctx = { graph }

  const errors = ERROR_RULES.flatMap((fn) => fn(cityData, ctx))
  const warnings = WARNING_RULES.flatMap((fn) => fn(cityData, ctx))

  return { errors, warnings }
}

// Validates every city in `citiesData` (array of parsed city JSON objects).
// Returns one `{ city, errors, warnings }` entry per city.
export function validateAllNetworks(citiesData) {
  return citiesData.map((cityData) => ({
    city: cityData.city,
    ...validateNetwork(cityData),
  }))
}
