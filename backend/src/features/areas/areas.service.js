import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROFILES = JSON.parse(
  readFileSync(path.join(__dirname, '../../data/area-profiles.json'), 'utf-8')
)

export function listAreas({ city } = {}) {
  if (!city) return PROFILES
  return PROFILES.filter((p) => p.city.toLowerCase() === city.toLowerCase())
}

export function getArea(slug) {
  const area = PROFILES.find((p) => p.slug === slug)
  if (!area) {
    const err = new Error('Area not found')
    err.statusCode = 404
    throw err
  }
  return area
}

export function matchArea(city, area) {
  if (!city) return null
  const cityLower = city.toLowerCase()
  const areaLower = (area ?? '').toLowerCase().trim()

  const cityProfiles = PROFILES.filter((p) => p.city.toLowerCase() === cityLower)
  if (!cityProfiles.length) return null

  if (areaLower) {
    // Exact name match
    const exact = cityProfiles.find(
      (p) => p.name.toLowerCase() === areaLower || p.fullName.toLowerCase() === areaLower
    )
    if (exact) return exact

    // Partial match — profile name appears in area string or vice-versa
    const partial = cityProfiles.find(
      (p) =>
        areaLower.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(areaLower)
    )
    if (partial) return partial
  }

  return null
}
