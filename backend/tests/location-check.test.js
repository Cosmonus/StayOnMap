// The listing location check — claimed pincode vs India Post, pin vs OSM.
//
// The design constraint under test: a false "your address is wrong" is WORSE
// than silence. It accuses an owner, in public, on our own error. So the
// distinctions these tests guard are the ones that keep accusations honest:
//
//   directory unseeded  → null       (we cannot check — NOT a finding)
//   pincode not found   → 'high'     (India Post has never issued it)
//   wrong-state pincode → 'high'     (cannot be a spelling quirk)
//   district differs    → 'info'     (sources legitimately disagree on names)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { checkListingLocation } from '../src/features/properties/locationCheck.js'
import { pincodeInfo, resetPincodeCache } from '../src/features/spatial/pincodeProvider.js'
import * as boundaryLookup from '../src/features/spatial/boundaryLookup.js'

const KORAMANGALA_ROWS = [
  { officeName: 'Koramangala VI Bk S.O', officeType: 'S.O', district: 'Bengaluru', state: 'KARNATAKA', taluk: 'Bangalore South' },
]

beforeEach(() => {
  vi.clearAllMocks()
  resetPincodeCache()
  prismaMock.pincodeDirectory = {
    count: vi.fn().mockResolvedValue(155_000),
    findMany: vi.fn().mockResolvedValue(KORAMANGALA_ROWS),
  }
  vi.spyOn(boundaryLookup, 'boundariesAt').mockResolvedValue(null)
})

describe('pincodeInfo', () => {
  it('distinguishes "directory not seeded" from "unknown pincode"', async () => {
    // Collapsing these turns "we didn't load the data" into "your pincode is
    // fake" — an accusation built on our own missing homework.
    prismaMock.pincodeDirectory.count.mockResolvedValue(0)
    const unseeded = await pincodeInfo('560095')
    expect(unseeded.available).toBe(false)

    // The seeded answer memoises (correctly — it gates every check in prod),
    // so flipping the fixture mid-test needs an explicit reset.
    resetPincodeCache()
    prismaMock.pincodeDirectory.count.mockResolvedValue(155_000)
    prismaMock.pincodeDirectory.findMany.mockResolvedValue([])
    const unknown = await pincodeInfo('999999')
    expect(unknown).toEqual({ available: true, found: null })
  })

  it('rejects non-pincode input without touching the database', async () => {
    expect((await pincodeInfo('56009')).found).toBeNull()
    expect((await pincodeInfo('abcdef')).found).toBeNull()
    expect((await pincodeInfo('')).found).toBeNull()
  })

  it('aggregates offices and reports every district a pincode spans', async () => {
    prismaMock.pincodeDirectory.findMany.mockResolvedValue([
      ...KORAMANGALA_ROWS,
      { officeName: 'Other B.O', officeType: 'B.O', district: 'Bengaluru Rural', state: 'KARNATAKA', taluk: null },
    ])
    const { found } = await pincodeInfo('560095')
    expect(found.districts).toEqual(['Bengaluru', 'Bengaluru Rural'])
    expect(found.offices).toHaveLength(2)
  })

  it('fails toward "cannot check" on infrastructure errors', async () => {
    prismaMock.pincodeDirectory.count.mockRejectedValue(new Error('db down'))
    expect((await pincodeInfo('560095')).available).toBe(false)
  })
})

describe('checkListingLocation', () => {
  it('passes a listing whose pincode matches its city', async () => {
    const r = await checkListingLocation({ pincode: '560095', city: 'Bengaluru' })
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(0)
    expect(r.groundTruth.state).toBe('KARNATAKA')
  })

  it('flags a pincode India Post has never issued — high', async () => {
    prismaMock.pincodeDirectory.findMany.mockResolvedValue([])
    const r = await checkListingLocation({ pincode: '999999', city: 'Bengaluru' })
    expect(r.ok).toBe(false)
    expect(r.findings[0]).toMatchObject({ code: 'unknown_pincode', level: 'high' })
  })

  it('flags a wrong-state pincode — high, and names both places', async () => {
    // A Bengaluru pincode on a listing claiming Chennai cannot be a spelling
    // quirk. This is the typo-or-invention case moderation should see.
    const r = await checkListingLocation({ pincode: '560095', city: 'Chennai' })
    expect(r.ok).toBe(false)
    expect(r.findings[0].code).toBe('pincode_state_mismatch')
    expect(r.findings[0].message).toMatch(/KARNATAKA/)
    expect(r.findings[0].message).toMatch(/Chennai/)
  })

  it('returns null — not a finding — when the directory is unseeded', async () => {
    prismaMock.pincodeDirectory.count.mockResolvedValue(0)
    expect(await checkListingLocation({ pincode: '560095', city: 'Bengaluru' })).toBeNull()
  })

  it('returns null when nothing is claimed', async () => {
    expect(await checkListingLocation({ city: 'Bengaluru' })).toBeNull()
  })

  it('reports a district difference as info, never as an accusation', async () => {
    // OSM says the pin is in "Bangalore Urban"; India Post says the pincode is
    // "Bengaluru". Same place, different vocabularies — the alias table must
    // absorb it. A genuinely different district still only rates 'info'.
    boundaryLookup.boundariesAt.mockResolvedValue([
      { adminLevel: 6, name: 'Kancheepuram' },
    ])
    const r = await checkListingLocation({ pincode: '560095', city: 'Bengaluru', lat: 12.9, lng: 80.1 })
    const district = r.findings.find((f) => f.code === 'district_looks_different')
    expect(district.level).toBe('info')
    expect(r.ok).toBe(true) // info alone never fails a listing
  })

  it('absorbs legitimate cross-source district spellings', async () => {
    boundaryLookup.boundariesAt.mockResolvedValue([
      { adminLevel: 6, name: 'Bangalore Urban' },
    ])
    const r = await checkListingLocation({ pincode: '560095', city: 'Bengaluru', lat: 12.93, lng: 77.62 })
    expect(r.findings).toHaveLength(0)
  })

  it('never throws into the listing flow', async () => {
    prismaMock.pincodeDirectory.count.mockImplementation(() => { throw new Error('boom') })
    await expect(checkListingLocation({ pincode: '560095', city: 'Bengaluru' })).resolves.toBeNull()
  })
})
