/**
 * The city dropdown and the map pin must agree.
 *
 * This exists because they didn't. A live production listing claimed
 * `city: 'Bengaluru'` (state Karnataka, pincode 560059 — all consistent) while
 * its pin sat at 13.0843, 80.2705, which is Chennai city centre, 290km away.
 * Nothing rejected it, because the two inputs were validated separately: `city`
 * against an enum, `lat`/`lng` against India's bounding box. Neither knew about
 * the other.
 *
 * The listing then disagreed with itself everywhere downstream — it drew on the
 * map in Chennai (pins use lat/lng), answered the Bengaluru city filter (that
 * reads the `city` column), and was described by a Chennai geohash cell.
 *
 * What each suite guards:
 *   cityMismatch          — the predicate: silent when it cannot judge, and
 *                           tolerant out to 100km so it only ever fires on a
 *                           contradiction no suburb can explain
 *   createProperty        — the contradiction is refused at the door
 *   updateProperty        — judged on the MERGED triple, so neither half of a
 *                           contradiction can be smuggled in one field at a time
 *   existing mismatches   — an unrelated edit is not held hostage by one
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { cityMismatch, MAX_CITY_DISTANCE_KM } from '../src/config/cityCenters.js'
import { createProperty, updateProperty } from '../src/features/properties/properties.service.js'

// The real coordinates from the production listing that exposed this.
const CHENNAI_PIN = { lat: 13.0843007, lng: 80.2704622 }
const BENGALURU_PIN = { lat: 12.9352, lng: 77.6245 }

function validListing(overrides = {}) {
  return {
    title: 'A perfectly ordinary flat',
    description: 'Ten characters at least.',
    type: 'APARTMENT',
    address: '5th Block, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560095',
    ...BENGALURU_PIN,
    rent: 25000,
    deposit: 50000,
    images: ['https://example.com/a.webp'],
    amenityIds: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── the predicate ───────────────────────────────────────────────────────────

describe('cityMismatch', () => {
  it('flags the real production listing: Bengaluru claimed, Chennai pin', () => {
    const m = cityMismatch('Bengaluru', CHENNAI_PIN.lat, CHENNAI_PIN.lng)
    expect(m).not.toBeNull()
    expect(m.distanceKm).toBeGreaterThan(280)
    // Naming the city the pin is really in is what makes the error actionable.
    expect(m.looksLike).toBe('Chennai')
  })

  it('is silent for a pin that matches its city', () => {
    expect(cityMismatch('Bengaluru', BENGALURU_PIN.lat, BENGALURU_PIN.lng)).toBeNull()
    expect(cityMismatch('Chennai', CHENNAI_PIN.lat, CHENNAI_PIN.lng)).toBeNull()
  })

  it('tolerates genuinely outlying suburbs well past every city radius', () => {
    // The largest radiusKm is Delhi's 60. A far-flung NCR address must not be
    // rejected — this check may only fire on an unarguable contradiction.
    expect(cityMismatch('Delhi', 28.4089, 77.3178)).toBeNull()   // Faridabad, ~30km
    expect(cityMismatch('Mumbai', 19.2183, 72.9781)).toBeNull()  // Thane, ~20km
    expect(cityMismatch('Chennai', 12.8185, 80.0400)).toBeNull() // Chengalpattu side, ~35km
  })

  it('still catches the closest pair of supported cities', () => {
    // Mumbai and Pune are ~120km apart — the tightest real confusion available,
    // and the reason the threshold is 100 and not higher.
    const m = cityMismatch('Mumbai', 18.5204, 73.8567)
    expect(m).not.toBeNull()
    expect(m.looksLike).toBe('Pune')
  })

  it('returns null rather than guessing when it cannot judge', () => {
    // "We cannot check" must never become "this is wrong" — an unknown city or a
    // missing/garbage coordinate is silence, not an accusation.
    expect(cityMismatch('Kochi', 9.9312, 76.2673)).toBeNull()
    expect(cityMismatch('Bengaluru', null, null)).toBeNull()
    expect(cityMismatch('Bengaluru', NaN, 77.5946)).toBeNull()
    expect(cityMismatch(undefined, 12.97, 77.59)).toBeNull()
  })

  it('reports no city name when the pin is outside every supported city', () => {
    // We know the claim is false without knowing the truth. Saying so beats
    // inventing a nearest-match.
    const m = cityMismatch('Bengaluru', 26.9124, 75.7873) // Jaipur
    expect(m).not.toBeNull()
    expect(m.looksLike).toBeNull()
  })

  it('keeps the threshold clear of every city radius', () => {
    expect(MAX_CITY_DISTANCE_KM).toBeGreaterThan(60)
  })
})

// ─── createProperty ──────────────────────────────────────────────────────────

describe('createProperty — coordinates must match the claimed city', () => {
  it('refuses a Bengaluru listing pinned in Chennai, and names both places', async () => {
    await expect(
      createProperty('owner-1', validListing({ city: 'Bengaluru', ...CHENNAI_PIN }))
    ).rejects.toMatchObject({ statusCode: 400 })

    await expect(
      createProperty('owner-1', validListing({ city: 'Bengaluru', ...CHENNAI_PIN }))
    ).rejects.toThrow(/Bengaluru.*Chennai/s)

    // Nothing reached the database — the guard runs before the transaction.
    expect(prismaMock.property.create).not.toHaveBeenCalled()
  })

  it('accepts a listing whose pin agrees with its city', async () => {
    prismaMock.property.create.mockResolvedValue({ id: 'p1', ...BENGALURU_PIN, type: 'APARTMENT' })
    await createProperty('owner-1', validListing())
    expect(prismaMock.property.create).toHaveBeenCalled()
  })
})

// ─── updateProperty ──────────────────────────────────────────────────────────

describe('updateProperty — neither half of a contradiction gets in alone', () => {
  const chennaiRow = { id: 'p1', ownerId: 'owner-1', city: 'Chennai', ...CHENNAI_PIN, type: 'APARTMENT' }

  it('rejects changing the city to one the existing pin contradicts', async () => {
    // Payload carries no coordinates at all — judged against the stored ones.
    prismaMock.property.findUnique.mockResolvedValue(chennaiRow)
    await expect(updateProperty('p1', 'owner-1', { city: 'Bengaluru' }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('rejects moving the pin to a city the existing claim contradicts', async () => {
    // The mirror image: payload carries no city, judged against the stored one.
    prismaMock.property.findUnique.mockResolvedValue({ ...chennaiRow, city: 'Bengaluru', ...BENGALURU_PIN })
    await expect(updateProperty('p1', 'owner-1', CHENNAI_PIN))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('rejects a single moved coordinate that drags the pin out of the city', async () => {
    // lat and lng are independently optional, so half a move is a valid request.
    prismaMock.property.findUnique.mockResolvedValue({ ...chennaiRow, city: 'Bengaluru', ...BENGALURU_PIN })
    await expect(updateProperty('p1', 'owner-1', { lng: 80.2704622 }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('accepts a location edit that moves city and pin together', async () => {
    prismaMock.property.findUnique.mockResolvedValue(chennaiRow)
    prismaMock.property.update.mockResolvedValue({ ...chennaiRow, city: 'Bengaluru', ...BENGALURU_PIN })
    await updateProperty('p1', 'owner-1', { city: 'Bengaluru', ...BENGALURU_PIN })
    expect(prismaMock.property.update).toHaveBeenCalled()
  })

  it('does not hold an unrelated edit hostage to a pre-existing mismatch', async () => {
    // The broken production row still has to be editable. Blocking a title
    // change on a location error the owner is not touching strands the listing
    // instead of repairing it.
    prismaMock.property.findUnique.mockResolvedValue({ ...chennaiRow, city: 'Bengaluru' })
    prismaMock.property.update.mockResolvedValue({ ...chennaiRow, city: 'Bengaluru', title: 'New title' })
    await updateProperty('p1', 'owner-1', { title: 'New title' })
    expect(prismaMock.property.update).toHaveBeenCalled()
  })
})
