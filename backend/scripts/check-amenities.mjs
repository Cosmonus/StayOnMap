#!/usr/bin/env node
/**
 * Amenity consistency checker.
 *
 * An amenity has to line up across four independent files, and nothing in the
 * type system or the tests notices when it doesn't:
 *
 *   prisma/amenities.js          the canonical names (what the DB gets seeded with)
 *   listings/config/onboarding.js  FEATURES chips — how an owner TAGS a listing
 *   config/filters.js            filter options — how a searcher FINDS it
 *   components/common/AmenityIcon  name → icon (else a generic fallback renders)
 *
 * ...times two, because web and mobile carry their own copies of the middle two.
 *
 * The failure is always silent, which is why this exists:
 *   - a chip name not in amenities.js  → the wizard drops it on create; the
 *     owner ticks a box and the listing is saved without it
 *   - a filter option no chip offers   → the filter matches nothing, forever
 *     (this is what 'Gated Security', 'Play Area', 'CCTV', 'Club House',
 *     'Intercom' and 'Rainwater Harvesting' all did until 2026-07-17)
 *   - a chip no filter offers          → a tag nobody can search by
 *
 * Usage: node scripts/check-amenities.mjs   (exit 1 on any problem)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// Strip // comments before reading string literals — an apostrophe in prose
// ("the type's own row") otherwise opens a phantom string and shifts every
// quote pair after it, silently hiding real names from this check.
const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '')
const quoted = (s) => [...stripComments(s).matchAll(/'([^']+)'/g)].map((m) => m[1])

// Canonical list — the only source of truth for what exists.
const AMENITIES = quoted(read('backend/prisma/amenities.js').match(/export const AMENITIES = \[[\s\S]*?\n\]/)[0])

// Wizard chips: opts arrays only — `label:` is prose, not an amenity name.
function chipsOf(platform) {
  const src = read(`${platform}/src/features/listings/config/onboarding.js`)
  const block = src.match(/export const FEATURES = \{[\s\S]*?\n\}/)[0]
  return new Set([...block.matchAll(/opts: \[([^\]]*)\]/g)].flatMap((m) => quoted(m[1])))
}

// Filter options: CORE_AMENITIES plus every per-type `id: 'amenities'` row.
function filtersOf(platform) {
  const src = read(`${platform}/src/config/filters.js`)
  const core = quoted(src.match(/const CORE_AMENITIES = \[[\s\S]*?\]\.map/)[0])
  const rows = [...src.matchAll(/id: 'amenities'[^\n]*options: asOptions\(\[([^\]]*)\]/g)].flatMap((m) => quoted(m[1]))
  return new Set([...core, ...rows])
}

function iconsOf(platform) {
  const file = platform === 'frontend'
    ? 'frontend/src/components/common/AmenityIcon.jsx'
    : 'mobile/src/components/common/AmenityIcon.js'
  const src = read(file)
  return new Set([...src.matchAll(/'([^']+)':\s+\w+,/g)].map((m) => m[1]))
}

const problems = []
const seed = new Set(AMENITIES)

if (AMENITIES.length !== seed.size) problems.push('amenities.js contains duplicate names')

for (const platform of ['frontend', 'mobile']) {
  const chips = chipsOf(platform)
  const filters = filtersOf(platform)
  const icons = iconsOf(platform)

  for (const name of chips) {
    if (!seed.has(name)) problems.push(`${platform}: chip "${name}" is not in prisma/amenities.js — the wizard will silently drop it`)
    if (!filters.has(name)) problems.push(`${platform}: chip "${name}" has no filter option — owners can tag it, nobody can search it`)
  }
  for (const name of filters) {
    if (!seed.has(name)) problems.push(`${platform}: filter option "${name}" is not in prisma/amenities.js`)
    if (!chips.has(name)) problems.push(`${platform}: filter option "${name}" is offered by no wizard chip — it can never match a listing`)
  }
  for (const name of AMENITIES) {
    if (!icons.has(name)) problems.push(`${platform}: "${name}" has no icon — renders the generic fallback`)
  }
}

// Web and mobile must not drift apart.
const [webChips, mobChips] = [chipsOf('frontend'), chipsOf('mobile')]
for (const n of webChips) if (!mobChips.has(n)) problems.push(`mobile is missing wizard chip "${n}" (web has it)`)
for (const n of mobChips) if (!webChips.has(n)) problems.push(`frontend is missing wizard chip "${n}" (mobile has it)`)

if (problems.length) {
  console.error(`\n✗ ${problems.length} amenity problem(s):\n`)
  for (const p of problems) console.error(`  · ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ ${AMENITIES.length} amenities consistent across seed, wizard chips, filters and icons (web + mobile)`)
