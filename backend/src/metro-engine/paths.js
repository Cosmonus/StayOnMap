// Every filesystem location the metro engine touches, in one place — the
// pipeline stages (fetch → parse → repair → compare → promote → export) each
// read/write a subset of these, and scattering the paths across stages is how
// the old one-off scripts drifted.
//
// Workspace dirs (RAW_DIR, CANDIDATE_DIR, COMPARE_DIR) are gitignored scratch;
// everything else is committed state.
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = path.resolve(__dirname, '../..')

// Shipped, production data — what metro.service.js serves and CI validates.
export const SOURCE_DIR = path.join(BACKEND_ROOT, 'src', 'data', 'metro-lines')

// Pipeline workspace (gitignored).
export const RAW_DIR = path.join(BACKEND_ROOT, 'data', 'metro-raw')
export const CANDIDATE_DIR = path.join(BACKEND_ROOT, 'data', 'metro-candidates')
export const COMPARE_DIR = path.join(BACKEND_ROOT, 'data', 'metro-compare')

// Committed engine state.
export const CURATION_FILE = path.join(BACKEND_ROOT, 'data', 'metro-curation.json')
export const SNAPSHOT_FILE = path.join(BACKEND_ROOT, 'data', 'metro-structure-snapshot.json')
export const QA_REPORT_FILE = path.join(BACKEND_ROOT, 'data', 'metro-qa-report.json')
// Markdown rendering of the QA report — note the repo gitignores *.md by
// design, so this one stays local while the .json is the committed artifact.
export const QA_REPORT_MD_FILE = path.join(BACKEND_ROOT, 'data', 'metro-qa-report.md')
export const BASELINE_FILE = path.join(BACKEND_ROOT, 'data', 'metro-validation-baseline.json')

// Derived frontend artifacts (kept in sync by the export stage; drift is a
// test failure — see backend/tests/metro-engine/drift.test.js).
export const FRONTEND_GEOJSON_FILE = path.join(BACKEND_ROOT, '..', 'frontend', 'src', 'data', 'layers', 'metro-lines.json')
export const IT_CORRIDORS_SRC_FILE = path.join(BACKEND_ROOT, 'src', 'data', 'it-corridors.json')
export const IT_CORRIDORS_OUT_FILE = path.join(BACKEND_ROOT, '..', 'frontend', 'src', 'data', 'layers', 'it-corridors.json')
