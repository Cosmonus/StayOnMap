// Engine-only tuning knobs. Validation thresholds (PATH_GAP_METERS etc.) live
// in ../lib/metro-validation/constants.js and are imported from there — these
// are the knobs for ingestion/parsing, which the validator never needs.

// Public Overpass instances, tried in order. The main one has 406'd from some
// environments before (see .claude/roadmap.md Addenda 10-11), so the mirrors
// are a real fallback path, same trio as scripts/fetch-osm-pois.mjs.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

export const REQUEST_TIMEOUT_MS = 180_000

// Endpoint matching when chaining a relation's way members end-to-end.
// Shared OSM nodes compare bit-identical; the metre fallback covers sloppy
// junctions where consecutive ways don't literally share a node.
export const WAY_SNAP_METERS = 50

// Deciding whether two route variants under one route_master are the two
// directions of the same line (merge) or a genuine branch (keep both):
//   1. Fast path: way-id Jaccard ≥ VARIANT_WAY_JACCARD_SAME — single-track
//      lines where both directions share literal ways.
//   2. Real test: double-tracked metros map each direction on its own
//      parallel way, so way identity says nothing — instead, the fraction of
//      the shorter variant's points lying within TRACK_PROXIMITY_METERS of
//      the longer's path must reach VARIANT_COVERAGE_SAME. Parallel tracks
//      sit tens of metres apart; a branch diverges by kilometres.
// Tuned against Ahmedabad's direction pairs and Delhi's Blue Line main/
// Vaishali branch — see the engine tests.
export const VARIANT_WAY_JACCARD_SAME = 0.5
export const VARIANT_COVERAGE_SAME = 0.8
export const TRACK_PROXIMITY_METERS = 150

// Gap-separated path components shorter than this are stray stub ways
// (depot spurs, tagging noise), droppable by repair without losing any
// passenger-visible track.
export const MIN_FRAGMENT_METERS = 50

// Stamped into every candidate's meta so a shipped file records which
// generation of parser produced it.
export const ENGINE_VERSION = 1

// Shipped files are named by lowercased city ("Delhi" → delhi.json). All 9
// supported cities are single ASCII words, so this is the whole mapping.
export const slugFor = (city) => city.toLowerCase()
