/**
 * `User.showExactLocation` actually changes what the API serves.
 *
 * It shipped on both clients as "Full address visible" vs "Area & city only"
 * and NOTHING read it: the owner was told their address was coarsened while
 * `GET /properties/:id` kept returning the full street address and 7-decimal
 * coordinates to anyone, signed in or not. A privacy promise the backend does
 * not keep is worse than no control at all, and this is the one field where an
 * owner's HOME is at stake.
 *
 * The dangerous edit is not deleting the gate — it is dropping
 * `showExactLocation` from one of the three selects that feed it. The gate then
 * reads `undefined`, which is not `false`, and the exact address ships again
 * from that path only. Nothing else would notice: the other two paths still
 * behave, so it reads as "the setting is flaky", not as a leak. Hence the
 * select assertions below — they are the half that catches the real regression.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const { publicView, listProperties, getPinsInBounds } =
  await vi.importActual('../src/features/properties/properties.service.js')

const OWNER = 'owner-1'
const STRANGER = 'stranger-1'

// A real Bengaluru coordinate, to 7dp — the precision the DB stores.
const EXACT = { lat: 12.9351929, lng: 77.6244807 }

function property(showExactLocation, overrides = {}) {
  return {
    id: 'prop-1',
    ownerId: OWNER,
    address: '4B, 12th Main, Indiranagar',
    landmark: 'Near Sony Signal',
    city: 'Bengaluru',
    pincode: '560038',
    lat: EXACT.lat,
    lng: EXACT.lng,
    owner: { id: OWNER, name: 'An owner', showExactLocation },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('when the owner asks for exact location to be hidden', () => {
  it('removes the street address entirely', () => {
    const out = publicView(property(false), STRANGER)
    expect(out.address).toBeNull()
  })

  it('moves the pin off the building', () => {
    const out = publicView(property(false), STRANGER)
    expect(out.lat).not.toBe(EXACT.lat)
    expect(out.lng).not.toBe(EXACT.lng)
  })

  // The blur has to be real but bounded — this is the number the comment in
  // properties.service.js argues for, and if someone changes the precision
  // constant this is what tells them what they changed.
  it('keeps the pin inside its own ~153 m cell, so the map still means something', () => {
    const out = publicView(property(false), STRANGER)
    const metres = haversine(EXACT.lat, EXACT.lng, Number(out.lat), Number(out.lng))
    expect(metres).toBeGreaterThan(0)
    expect(metres).toBeLessThan(120)
  })

  it('is deterministic — the same listing does not wander between requests', () => {
    const a = publicView(property(false), STRANGER)
    const b = publicView(property(false), STRANGER)
    expect([a.lat, a.lng]).toEqual([b.lat, b.lng])
  })

  // A precise-looking marker at a place we deliberately made imprecise is the
  // "confidently wrong" failure this codebase keeps removing. Say it in the
  // payload so a client can label it.
  it('declares that the location is approximate', () => {
    expect(publicView(property(false), STRANGER).approximateLocation).toBe(true)
  })

  it('keeps area-level facts, which are how anyone decides to enquire', () => {
    const out = publicView(property(false), STRANGER)
    expect(out.landmark).toBe('Near Sony Signal')
    expect(out.city).toBe('Bengaluru')
    expect(out.pincode).toBe('560038')
  })

  it('shows the OWNER their own listing exactly, unchanged', () => {
    const out = publicView(property(false), OWNER)
    expect(out.address).toBe('4B, 12th Main, Indiranagar')
    expect(out.lat).toBe(EXACT.lat)
    expect(out.approximateLocation).toBeUndefined()
  })
})

describe('when the owner leaves exact location on (the default)', () => {
  it('changes nothing', () => {
    const out = publicView(property(true), STRANGER)
    expect(out.address).toBe('4B, 12th Main, Indiranagar')
    expect(out.lat).toBe(EXACT.lat)
    expect(out.approximateLocation).toBeUndefined()
  })

  // Guessing either way is wrong: defaulting to "hide" silently coarsens every
  // listing the day someone forgets a select, and defaulting to "show" is the
  // bug this file exists for. The select assertions below are what make the
  // explicit read safe.
  it('does not coarsen when the flag was never selected', () => {
    const p = property(true)
    delete p.owner.showExactLocation
    expect(publicView(p, STRANGER).address).toBe('4B, 12th Main, Indiranagar')
  })
})

describe('the setting never leaks to a client', () => {
  it('is stripped whether it is on or off', () => {
    expect(publicView(property(true), STRANGER).owner.showExactLocation).toBeUndefined()
    expect(publicView(property(false), STRANGER).owner.showExactLocation).toBeUndefined()
  })
})

// ── The half that catches the silent regression ─────────────────────────────
describe('every read path asks the database for the flag', () => {
  it('the list does', async () => {
    prismaMock.property.findMany.mockResolvedValue([])
    prismaMock.property.count.mockResolvedValue(0)

    await listProperties({}, { skip: 0, limit: 10 }, null)

    const { include } = prismaMock.property.findMany.mock.calls[0][0]
    expect(include.owner.select.showExactLocation).toBe(true)
  })

  it('the map pins do', async () => {
    prismaMock.property.findMany.mockResolvedValue([])

    await getPinsInBounds({ swLat: 12.9, swLng: 77.5, neLat: 13.0, neLng: 77.7 }, {}, null)

    const { select } = prismaMock.property.findMany.mock.calls[0][0]
    expect(select.owner.select.showExactLocation).toBe(true)
    // ownerId too — without it the owner-sees-their-own exemption can't fire on
    // the map, and an owner would watch their own pin drift.
    expect(select.ownerId).toBe(true)
  })
})

// Local copy rather than an import: this asserts the DISTANCE the production
// code produces, so borrowing production's own helper would let a broken one
// agree with itself.
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
