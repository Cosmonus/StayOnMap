// Public API surface for the metro-network validation library — a pure
// barrel re-exporting everything. Imported by both
// backend/scripts/validate-metro-data.mjs (real files) and
// backend/tests/metro-validation.test.js (fixtures); the actual check
// logic lives in validate.js/rules.js/report.js/graph.js, not duplicated
// here or anywhere else.

export * from './validate.js'
export * from './report.js'
export * from './graph.js'
export * from './rules.js'
export * from './constants.js'
