/**
 * Cities parity — 2026-08-24
 *
 * The city table exists three times: backend (CITY_TABLE, with radii), web
 * (CITIES, with curated areas) and mobile (a copy of web). Three copies of a
 * list that gates signup, listing creation and the map is how the platform
 * once ended up with three independently hardcoded city lists that disagreed
 * (roadmap P7 addendum 2). This reads all three and fails on the first row
 * that differs — name, state, coordinates or order.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { CITY_TABLE, SUPPORTED_STATES, STATE_OF_CITY } from '../src/config/cities.js'
import { CITY_CENTERS, resolveCity } from '../src/config/cityCenters.js'

const ROOT = resolve(import.meta.dirname, '../..')

// Both client files are plain data: a `CITIES` literal plus derived exports.
// Evaluate the literal only — importing the module would need a bundler alias.
function clientCities(relPath) {
  const src = readFileSync(resolve(ROOT, relPath), 'utf8')
  const m = src.match(/export const CITIES = (\[[\s\S]*?\n\])/)
  if (!m) throw new Error(`${relPath}: no CITIES literal`)
  return new Function(`return ${m[1]}`)()
}

const CLIENTS = {
  web: 'frontend/src/config/cities.js',
  mobile: 'mobile/src/config/cities.js',
}

describe('the city table is one table', () => {
  for (const [label, path] of Object.entries(CLIENTS)) {
    it(`${label} mirrors the backend row for row`, () => {
      const rows = clientCities(path)
      expect(rows.map((c) => c.name)).toEqual(CITY_TABLE.map((c) => c.name))
      rows.forEach((c, i) => {
        const b = CITY_TABLE[i]
        expect({ name: c.name, state: c.state, lat: c.lat, lng: c.lng, core: c.core === true })
          .toEqual({ name: b.name, state: b.state, lat: b.lat, lng: b.lng, core: b.core === true })
        expect(Array.isArray(c.areas)).toBe(true)
      })
    })
  }

  it('every city sits in a supported state, and every supported state has a city', () => {
    for (const c of CITY_TABLE) expect(SUPPORTED_STATES).toContain(c.state)
    for (const s of SUPPORTED_STATES) expect(CITY_TABLE.some((c) => c.state === s)).toBe(true)
  })

  it('names are unique and every row has a centre the spatial layer can use', () => {
    expect(new Set(CITY_TABLE.map((c) => c.name)).size).toBe(CITY_TABLE.length)
    for (const c of CITY_TABLE) {
      expect(CITY_CENTERS[c.name]).toEqual({ lat: c.lat, lng: c.lng, radiusKm: c.radiusKm })
      expect(c.radiusKm).toBeGreaterThan(0)
      // India.
      expect(c.lat).toBeGreaterThan(6); expect(c.lat).toBeLessThan(38)
      expect(c.lng).toBeGreaterThan(68); expect(c.lng).toBeLessThan(98)
      expect(STATE_OF_CITY[c.name]).toBe(c.state.toUpperCase())
    }
  })

  it('each centre resolves to itself — no city is swallowed by a bigger neighbour', () => {
    for (const c of CITY_TABLE) expect(resolveCity(c.lat, c.lng)?.city).toBe(c.name)
  })
})
