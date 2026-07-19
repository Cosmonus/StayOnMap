// Wrapper kept for muscle memory and existing doc links — the actual
// transform now lives in src/metro-engine/export/geojson.js so the engine
// CLI (scripts/metro-engine.mjs export), the promote stage, and the drift
// test (tests/metro-engine/drift.test.js) all share one implementation.
import { runExport } from '../src/metro-engine/export/geojson.js'

const { featureCount, outFile } = runExport()
console.log(`Wrote ${featureCount} features to ${outFile}`)
