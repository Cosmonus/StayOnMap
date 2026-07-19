# Metro Data Engine

The repeatable pipeline that produces `backend/src/data/metro-lines/{city}.json`
— the metro networks rendered on the web map (via a derived GeoJSON bundle) and
mobile (served verbatim by `GET /api/v1/metro?city=`). It replaced hand-editing
those files (see `.claude/roadmap.md` addenda 3–12 for the era it ended).

```
fetch → parse → repair → validate → compare → promote → export
                                        (gate)      (frontend GeoJSON)
```

Run everything through the CLI:

```bash
cd backend
npm run metro -- help
npm run metro -- fetch --confirm            # Overpass → data/metro-raw/ (gitignored cache)
npm run metro -- parse                      # raw → data/metro-candidates/ (offline, repeatable)
npm run metro -- repair                     # deterministic cleanup, idempotent, fully logged
npm run metro -- compare                    # candidate vs shipped diff + promotion gate
npm run metro -- promote --city Delhi --confirm   # gated; updates shipped + GeoJSON + baseline + snapshot
npm run metro -- qa --md                    # per-city health report (data/metro-qa-report.json)
```

## Design rules

- **Never invent geometry, never fabricate stations.** Repairs only remove,
  reorder, or merge. A gap in OSM stays a visible gap (`segments` /
  render-time splitting), never a drawn bridge.
- **Ordering comes from the OSM relation.** Way members are chained in
  relation member order with orientation flipping (`parse/chain.js`) — the fix
  for the historical "teleporting lines" bug.
- **One line per route_master.** OSM models one route relation per direction;
  `parse/variants.js` groups them under their route_master and merges
  directions geometrically (parallel tracks share no way ids, so way-identity
  alone can never merge them). Genuine branches stay separate lines.
- **Stations come from relation membership** (role `stop`/`stop_entry_only`/
  `stop_exit_only`), not proximity guessing; proximity is a logged fallback
  for pre-PT-v2 relations only. Same-named platform nodes within 400 m merge
  into one station; 2+ distinct lines there = interchange. English names
  preferred (`name:en` over `name`).
- **Lifecycle filtering is evidence, not absence.** proposed/construction
  relations are deliberately fetched and then excluded with a logged reason
  (`meta.excludedRelations`) — the fix for the Chennai-Phase-2 ghost-line bug.
- **Human knowledge lives in `backend/data/metro-curation.json`**, never in
  code: per-city exclude/include/rename rules, each with a `ruleId` and a
  written reason, stamped into shipped `meta.curationApplied`.
- **Promotion is gated and per-city.** `promote` re-derives from the raw
  cache, refuses if the candidate has any validation error or more warnings
  than shipped, and there is deliberately no `--force`. A failed/empty fetch
  can never wipe a city (Surat keeps its station-only data until its metro
  has OSM route relations). On success it atomically updates: the shipped
  file, `frontend/src/data/layers/metro-lines.json` (drift is a test failure —
  `tests/metro-engine/drift.test.js`), the city's slice of
  `data/metro-validation-baseline.json`, and
  `data/metro-structure-snapshot.json` (which `tests/metro-validation.test.js`
  holds shipped data to).

## Schema (additive over the pre-engine shape)

Old consumers ignore the new fields; `path` stays authoritative.

```jsonc
{
  "city": "Delhi",
  "meta": { "source": "overpass", "fetchedAt": "…", "osmDataTimestamp": "…",
            "engineVersion": 1, "curationApplied": ["…"],
            "excludedRelations": [{ "id": 1, "name": "…", "reason": "…" }] },
  "lines": [{ "name": "Blue Line", "color": "#4169e1", "path": [[lat, lng]],
              "osmRelationId": 1, "osmRouteMasterId": 2, "variantRelationIds": [1, 3],
              "segments": [[[lat, lng]]] /* only when the line genuinely splits */ }],
  "stations": [{ "name": "Rajiv Chowk", "lat": 0, "lng": 0, "lines": [0, 1],
                 "osmNodeId": 1, "osmNodeIds": [1, 2] }]
}
```

## Module map

| Path | Responsibility |
|---|---|
| `import/overpass.js` | Overpass client (endpoint rotation, timeouts) |
| `import/query.js` | OverpassQL builder (routes-first, masters via back-membership) |
| `import/fetch.js` | raw-cache envelopes; `--from-file` manual-download ingest |
| `parse/elements.js` | raw element indexing |
| `parse/lifecycle.js` | operational vs excluded, with reasons |
| `parse/chain.js` | way chaining in relation order + orientation flip |
| `parse/variants.js` | route_master grouping + direction merge |
| `parse/stations.js` | role-based stops, suffix stripping, interchange merge |
| `parse/parse.js` | orchestrator → candidate + parse log |
| `repair/repairs.js` | pure repairs (dedupe, fragments, ordering, colors, names, dup-line merge) |
| `repair/repair.js` | composer — idempotent, change-logged |
| `compare/compare.js` | candidate↔shipped diff + promotion gate |
| `export/geojson.js` | shipped files → frontend GeoJSON (+ it-corridors sync) |
| `export/segments.js` | additive pre-split `segments` field |
| `curation.js` / `qa.js` / `snapshot.js` | curation loading, QA report, count snapshot |

Validation itself lives in `../lib/metro-validation/` (predates the engine;
8 ERROR + 9 WARNING rules, baseline mechanism, CI-gated by
`tests/metro-validation.test.js`) and is reused, not duplicated.

Tests: `backend/tests/metro-engine/` — synthetic fixtures per stage, a trimmed
real golden capture (Ahmedabad Blue Line), the GeoJSON drift guard, and
idempotence/determinism checks.
