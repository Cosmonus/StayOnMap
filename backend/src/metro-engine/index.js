// Public surface of the metro data engine. Also re-exports the validation
// library (../lib/metro-validation) so engine consumers have one import — the
// validator itself stays where it is; it predates the engine and is imported
// directly by scripts/validate-metro-data.mjs and the CI test suite.
export * from '../lib/metro-validation/index.js'
export * from './constants.js'
export * from './paths.js'
export * from './store.js'
export * from './snapshot.js'
export * from './export/geojson.js'
