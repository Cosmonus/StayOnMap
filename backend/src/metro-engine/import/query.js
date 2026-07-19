// OverpassQL for a city's metro network. One query per city over the full
// cityCenters.js bbox — metro relations per city number in the dozens (not
// the hundreds of thousands the POI fetcher tiles for), so no tiling.
//
// Design notes, each load-bearing:
//   - Routes are matched by bbox FIRST, then their route_masters found via
//     backward membership (`relation(br.routes)`). The reverse order —
//     bbox-matching masters directly — is unreliable in Overpass: a
//     route_master's members are relations, and bbox filters only consider
//     node/way members when computing a relation's box.
//   - `out geom` on routes resolves every way member to an inline coordinate
//     array IN RELATION MEMBER ORDER — the chainer consumes that directly,
//     no way/node stitching pass.
//   - proposed/construction routes are fetched DELIBERATELY so the lifecycle
//     filter excludes them from evidence with a logged reason, rather than
//     their absence being indistinguishable from Overpass missing them.
//     (This is the fix for the Chennai-Phase-2 ghost-line class of bug.)
//   - `route=train` is NOT in the tag net (it would pull all of Indian
//     Railways); RRTS-type systems enter via curation includeRelationIds.
export function bboxFor({ lat, lng, radiusKm }) {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng }
}

const METRO_ROUTE_TYPES = '^(subway|light_rail|monorail)$'

export function buildMetroQuery(bbox, includeRelationIds = []) {
  const bb = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`
  const curated = includeRelationIds.length ? `  relation(id:${includeRelationIds.join(',')});\n` : ''
  return `[out:json][timeout:170];
(
  relation["type"="route"]["route"~"${METRO_ROUTE_TYPES}"]${bb};
  relation["type"="route"]["route"="construction"]["construction"~"${METRO_ROUTE_TYPES}"]${bb};
  relation["type"="route"]["route"="proposed"]["proposed"~"${METRO_ROUTE_TYPES}"]${bb};
${curated})->.routes;
relation(br.routes)["type"="route_master"]->.masters;
(.routes; relation(r.masters)["type"="route"];)->.routes;
.masters out body;
.routes out geom;
node(r.routes);
out body;`
}
