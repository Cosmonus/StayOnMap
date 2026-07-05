// One-off cleanup: removes exact-duplicate consecutive path points from
// every backend/src/data/metro-lines/*.json line — these are harmless
// leftovers from OSM way-segment concatenation (a shared endpoint counted
// twice when two segments were joined), but they also produce a cascade of
// spurious "self-intersecting geometry" false positives in the new
// validator (a zero-length segment sitting exactly on an adjacent
// segment's endpoint looks like a crossing). Run manually; not wired into
// any build step, matching this repo's other one-off scripts/*.mjs.
//
// Usage: node scripts/dedupe-metro-paths.mjs [--confirm]
// Defaults to a dry run; pass --confirm to actually write the files.

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../src/data/metro-lines')
const CONFIRM = process.argv.includes('--confirm')

const EARTH_RADIUS_M = 6371000
const DUPLICATE_POINT_METERS = 5

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function dedupePath(path) {
  if (path.length === 0) return path
  const result = [path[0]]
  let removed = 0
  for (let i = 1; i < path.length; i++) {
    if (haversineMeters(result.at(-1), path[i]) < DUPLICATE_POINT_METERS) {
      removed++
      continue
    }
    result.push(path[i])
  }
  return { path: result, removed }
}

let totalRemoved = 0
for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
  const fullPath = path.join(DATA_DIR, file)
  const data = JSON.parse(readFileSync(fullPath, 'utf-8'))
  let fileRemoved = 0
  data.lines = data.lines.map((line) => {
    const { path: dedupedPath, removed } = dedupePath(line.path)
    fileRemoved += removed
    return { ...line, path: dedupedPath }
  })
  if (fileRemoved > 0) {
    console.log(`${file}: removed ${fileRemoved} duplicate point(s)`)
    totalRemoved += fileRemoved
    if (CONFIRM) writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n')
  }
}

console.log(`\nTotal duplicate points ${CONFIRM ? 'removed' : 'found (dry run)'}: ${totalRemoved}`)
if (!CONFIRM) console.log('Re-run with --confirm to write changes.')
