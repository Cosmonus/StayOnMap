import { describe, it, expect } from 'vitest'
import { MODULES, MODULES_BY_KEY, isStale } from '../src/features/spatial/registry.js'
import { PROVENANCE, STATUS, buildEnvelope } from '../src/features/spatial/envelope.js'
import { nextPeakDeparture } from '../src/features/spatial/modules/mobility.module.js'
import { encode, decode } from '../src/lib/geohash.js'
import { resolveCity } from '../src/config/cityCenters.js'

// env.googleMapsKey is null in tests (see tests/setup.js), so every provider
// returns null. That is deliberate rather than a limitation: it exercises the
// exact degraded path a fresh checkout and a blown API budget both hit, and it
// proves the modules still emit a well-formed, honest envelope with no
// external data at all.

const CELLS = [
  { name: 'Indiranagar, Bengaluru', lat: 12.9784, lng: 77.6408 },
  { name: 'T. Nagar, Chennai',      lat: 13.0418, lng: 80.2341 },
  { name: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'Surat (metro u/c)',      lat: 21.1702, lng: 72.8311 },
  { name: 'rural — no city',        lat: 26.9124, lng: 75.7873 },
]

function cellFor({ lat, lng }) {
  const geohash = encode(lat, lng)
  const centre = decode(geohash)
  return { geohash, ...centre, city: resolveCity(centre.lat, centre.lng)?.city ?? null }
}

describe('module definitions', () => {
  it('every module declares the fields the runner depends on', () => {
    for (const m of MODULES) {
      expect(typeof m.key, `${m.key}: key`).toBe('string')
      expect(Number.isInteger(m.version), `${m.key}: version`).toBe(true)
      expect(typeof m.compute, `${m.key}: compute`).toBe('function')
      expect(Array.isArray(m.inputs), `${m.key}: inputs`).toBe(true)
      expect(m.inputs.length, `${m.key}: must declare at least one input`).toBeGreaterThan(0)
      expect(m.ttlHours, `${m.key}: ttlHours`).toBeGreaterThan(0)
    }
  })

  it('input weights are positive — a zero-weight input is invisible to confidence', () => {
    for (const m of MODULES) {
      for (const i of m.inputs) {
        expect(i.weight, `${m.key}.${i.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('maxConfidence stays within 0..1', () => {
    for (const m of MODULES) {
      const cap = m.maxConfidence ?? 1
      expect(cap).toBeGreaterThan(0)
      expect(cap).toBeLessThanOrEqual(1)
    }
  })

  it('module keys are unique', () => {
    expect(Object.keys(MODULES_BY_KEY)).toHaveLength(MODULES.length)
  })
})

// The load-bearing test. Every fact every module can produce, across a spread
// of real cells, must satisfy the provenance contract. fact() throws on a bad
// fact, so a violation surfaces here as a failure rather than shipping as an
// unattributed number on a property page.
describe('every module output satisfies the provenance contract', () => {
  for (const place of CELLS) {
    for (const module of MODULES) {
      it(`${module.key} @ ${place.name}`, async () => {
        const cell = cellFor(place)
        const envelope = buildEnvelope(module, await module.compute(cell))

        expect(Object.values(STATUS)).toContain(envelope.status)

        for (const f of envelope.facts) {
          expect(Object.values(PROVENANCE), `${f.key} provenance`).toContain(f.provenance)
          expect(f.source, `${f.key} source`).toBeTruthy()
          expect(f.display, `${f.key} display`).toBeTruthy()
          if (f.provenance === PROVENANCE.ESTIMATED) {
            expect(f.method, `${f.key} must explain its estimate`).toBeTruthy()
          }
        }

        // Confidence must reflect reality, not optimism.
        expect(envelope.confidence.value).toBeGreaterThanOrEqual(0)
        expect(envelope.confidence.value).toBeLessThanOrEqual(module.maxConfidence ?? 1)

        // A module that can't say anything must say so, in words.
        if (envelope.status === STATUS.UNAVAILABLE) {
          expect(envelope.missing.length, `${module.key} must explain its silence`).toBeGreaterThan(0)
        }
      })
    }
  }
})

describe('mobility — facts from data StayOnMap already owns', () => {
  it('finds a real metro station with no external API available', async () => {
    const cell = cellFor(CELLS[0]) // Indiranagar has a Purple Line station
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cell))

    const nearest = envelope.facts.find((f) => f.key === 'nearest_metro')
    expect(nearest).toBeDefined()
    // DERIVED, not MEASURED — corrected 2026-07-19. The station's coordinates
    // are measured (OSM); the DISTANCE to them is haversine arithmetic, which
    // envelope.js's contract defines as DERIVED. It mattered beyond pedantry:
    // the distance was computed from the geohash CELL centre, so a property at
    // the cell edge inherited up to ~108 m of error under a label that claims
    // someone observed it. The fix carries the station's coordinates on the
    // fact (`at`) so the read path re-anchors to the real property — see
    // reanchor.js. Don't put MEASURED back.
    expect(nearest.provenance).toBe(PROVENANCE.DERIVED)
    expect(nearest.at).toEqual({ lat: expect.any(Number), lng: expect.any(Number) })
    expect(nearest.value).toBeLessThan(2500)

    // Walk time is an estimate and must own up to it.
    const walk = envelope.facts.find((f) => f.key === 'walk_time_metro')
    expect(walk.provenance).toBe(PROVENANCE.ESTIMATED)
    expect(walk.method).toMatch(/1\.35/)
  })

  it('says a network is under construction rather than implying service', async () => {
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cellFor(CELLS[3])))
    expect(envelope.missing.join(' ')).toMatch(/under construction/i)
  })

  // Surat has 34 mapped stations and zero operating lines. This read
  // "Metro nearby, but not a short walk" and offered a walking time — both
  // schema-valid, both wrong about the only thing a renter cares about.
  // Caught by rendering the output, not by a type check.
  it('never implies access to a station whose line is not running', async () => {
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cellFor(CELLS[3])))

    expect(envelope.assessment.label).toMatch(/not yet running/i)
    expect(envelope.assessment.label).not.toMatch(/within walking distance/i)
    expect(envelope.facts.find((f) => f.key === 'nearest_metro').label).toMatch(/planned/i)
    // No walking time to a construction site.
    expect(envelope.facts.find((f) => f.key === 'walk_time_metro')).toBeUndefined()
  })

  it('does offer a walking time where the network actually runs', async () => {
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cellFor(CELLS[0])))
    expect(envelope.facts.find((f) => f.key === 'walk_time_metro')).toBeDefined()
    expect(envelope.facts.find((f) => f.key === 'nearest_metro').label).not.toMatch(/planned/i)
  })

  it('says so plainly when a location is outside the covered cities', async () => {
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cellFor(CELLS[4])))
    expect(envelope.missing.join(' ')).toMatch(/outside the cities/i)
  })

  it('always admits bus frequency is unknown — stops are not timetables', async () => {
    const envelope = buildEnvelope(MODULES_BY_KEY.mobility, await MODULES_BY_KEY.mobility.compute(cellFor(CELLS[1])))
    expect(envelope.missing.join(' ')).toMatch(/frequency is unknown/i)
  })
})

describe('nextPeakDeparture()', () => {
  // The existing computeTraffic() asks for `departure_time: 'now'`, so a 3am
  // cache miss reports light traffic as if it were the commute. Congestion is
  // a property of the hour, not of when we happened to ask.
  const IST_OFFSET_MS = 330 * 60 * 1000

  it('is always in the future', () => {
    for (const iso of ['2026-07-19T00:00:00Z', '2026-07-21T03:29:00Z', '2026-07-21T03:31:00Z', '2026-12-31T23:59:00Z']) {
      const now = new Date(iso)
      expect(nextPeakDeparture(now) * 1000).toBeGreaterThan(now.getTime())
    }
  })

  it('always lands on a Tuesday at 09:00 IST', () => {
    for (let d = 0; d < 14; d++) {
      const now = new Date(Date.UTC(2026, 6, 19 + d, 11, 17, 0))
      const ist = new Date(nextPeakDeparture(now) * 1000 + IST_OFFSET_MS)
      expect(ist.getUTCDay(), `day for offset ${d}`).toBe(2)
      expect(ist.getUTCHours(), `hour for offset ${d}`).toBe(9)
      expect(ist.getUTCMinutes()).toBe(0)
    }
  })

  it('rolls to next week when today is Tuesday past 9am IST', () => {
    // 2026-07-21 is a Tuesday. 04:00Z = 09:30 IST — just past the window.
    const now = new Date('2026-07-21T04:00:00Z')
    const days = (nextPeakDeparture(now) * 1000 - now.getTime()) / 86_400_000
    expect(days).toBeGreaterThan(6)
  })
})

describe('registry.isStale()', () => {
  const module = { key: 'mobility', version: 2 }
  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  it('treats a missing envelope as stale', () => {
    expect(isStale(undefined, module)).toBe(true)
  })

  it('recomputes when the module version moves — this is the backfill mechanism', () => {
    expect(isStale({ version: 1, staleAfter: future }, module)).toBe(true)
    expect(isStale({ version: 2, staleAfter: future }, module)).toBe(false)
  })

  it('recomputes once staleAfter has passed', () => {
    expect(isStale({ version: 2, staleAfter: past }, module)).toBe(true)
  })

  it('treats a malformed envelope as stale rather than trusting it', () => {
    expect(isStale({ version: 2 }, module)).toBe(true)
  })
})
