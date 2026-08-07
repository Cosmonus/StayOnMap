/**
 * Relationship signals — 2026-08-07
 *
 * Two FraudSignalTypes have been in the schema since the trust system was built
 * with nothing producing them: REUSED_IMAGES and SAME_CONTACT. Both look BEYOND
 * a single listing, which is what every other integrity check cannot do.
 *
 * The rule both obey, and the reason they are evidence rather than verdicts:
 * a shared phone number is a broker running five accounts OR a family sharing a
 * landline, and only a moderator can tell. Nothing here blocks, suspends or
 * accuses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import sharp from 'sharp'
import {
  dHash, hammingDistance, findReusedImages, MATCH_DISTANCE,
} from '../src/features/intelligence/imageFingerprint.js'
import { normalisePhone, findSharedContactOwners } from '../src/features/intelligence/ownerGraph.js'

beforeEach(() => { vi.clearAllMocks() })

// A deterministic gradient — a real image, so sharp does real work, but one
// whose small perturbations are predictable.
async function gradient({ width = 256, height = 256, shift = 0 } = {}) {
  const pixels = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = (x + y + shift) % 256
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer()
}

describe('dHash', () => {
  it('produces 64 bits as 16 hex characters', async () => {
    const hash = await dHash(await gradient())
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is stable for the same image', async () => {
    const image = await gradient()
    expect(await dHash(image)).toBe(await dHash(image))
  })

  it('survives a resize — the whole reason it is not a checksum', async () => {
    const original = await gradient({ width: 256, height: 256 })
    const resized = await sharp(original).resize(96, 96).png().toBuffer()

    // A sha256 of these two differs completely. This must not.
    expect(hammingDistance(await dHash(original), await dHash(resized)))
      .toBeLessThanOrEqual(MATCH_DISTANCE)
  })

  it('survives a re-encode to a lossy format', async () => {
    const original = await gradient()
    const jpeg = await sharp(original).jpeg({ quality: 60 }).toBuffer()

    expect(hammingDistance(await dHash(original), await dHash(jpeg)))
      .toBeLessThanOrEqual(MATCH_DISTANCE)
  })
})

describe('hammingDistance', () => {
  it('is zero for identical hashes', () => {
    expect(hammingDistance('ffffffffffffffff', 'ffffffffffffffff')).toBe(0)
  })

  it('counts differing bits', () => {
    expect(hammingDistance('0000000000000000', '0000000000000003')).toBe(2)
  })

  it('refuses to compare a missing hash rather than reporting a match', () => {
    // Returning 0 here would make every un-fingerprinted image match every
    // other one — a false accusation generator.
    expect(hammingDistance(null, 'ffffffffffffffff')).toBe(Number.MAX_SAFE_INTEGER)
    expect(hammingDistance('ff', 'ffffffffffffffff')).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('findReusedImages', () => {
  const MINE = 'https://cdn/a_full.webp'
  const THEIRS = 'https://cdn/b_full.webp'

  it('reports nothing when the listing has no photos', async () => {
    prismaMock.propertyImage.findMany.mockResolvedValue([])
    await expect(findReusedImages('p1')).resolves.toEqual([])
  })

  it('reports nothing when no photo has been fingerprinted yet', async () => {
    prismaMock.propertyImage.findMany.mockResolvedValue([{ url: MINE }])
    prismaMock.imageFingerprint.findMany.mockResolvedValue([])

    // A fresh install with no backfill must read as "no evidence", never as
    // "no match found" and certainly never as a match.
    await expect(findReusedImages('p1')).resolves.toEqual([])
  })

  it('finds a near-identical photo on another listing, and says whose', async () => {
    prismaMock.propertyImage.findMany
      .mockResolvedValueOnce([{ url: MINE }])
      .mockResolvedValueOnce([{ url: THEIRS, propertyId: 'p2', property: { ownerId: 'owner2' } }])
    prismaMock.imageFingerprint.findMany
      .mockResolvedValueOnce([{ url: MINE, hash: '0f0f0f0f0f0f0f0f' }])
      .mockResolvedValueOnce([{ url: THEIRS, hash: '0f0f0f0f0f0f0f0e' }])

    const [match] = await findReusedImages('p1')
    expect(match).toMatchObject({ propertyId: 'p2', ownerId: 'owner2', closest: 1 })
  })

  it('ignores a photo that is merely a different room', async () => {
    prismaMock.propertyImage.findMany
      .mockResolvedValueOnce([{ url: MINE }])
      .mockResolvedValueOnce([{ url: THEIRS, propertyId: 'p2', property: { ownerId: 'owner2' } }])
    prismaMock.imageFingerprint.findMany
      .mockResolvedValueOnce([{ url: MINE, hash: '0000000000000000' }])
      .mockResolvedValueOnce([{ url: THEIRS, hash: 'ffffffffffffffff' }])

    await expect(findReusedImages('p1')).resolves.toEqual([])
  })
})

describe('normalisePhone', () => {
  it('reduces the same number typed three ways to one value', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalisePhone('098765-43210')).toBe('9876543210')
    expect(normalisePhone('9876543210')).toBe('9876543210')
  })

  it('rejects anything that is not a plausible Indian mobile', () => {
    // A shared landline or a 4-digit extension is not evidence of anything.
    expect(normalisePhone('044 2345 6789')).toBeNull()
    expect(normalisePhone('1234')).toBeNull()
    expect(normalisePhone(null)).toBeNull()
    expect(normalisePhone('')).toBeNull()
  })
})

describe('findSharedContactOwners', () => {
  it('reports nothing for an owner with no usable number', async () => {
    await expect(findSharedContactOwners('u1', null)).resolves.toBeNull()
    expect(prismaMock.user.findMany).not.toBeDefined()
  })

  it('reports other listing accounts on the same number, and whether they verified it', async () => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue([
      { id: 'u2', name: 'B', phone: '+919876543210', isVerified: true, phoneVerifiedAt: new Date(), _count: { properties: 3 } },
      { id: 'u3', name: 'C', phone: '9876543210', isVerified: false, phoneVerifiedAt: null, _count: { properties: 1 } },
    ])

    const found = await findSharedContactOwners('u1', '98765 43210')

    expect(found.phone).toBe('9876543210')
    expect(found.accounts).toHaveLength(2)
    expect(found.accounts.filter((a) => a.phoneVerified)).toHaveLength(1)
  })

  it('matches across formatting — the case a SQL endsWith silently misses', async () => {
    // "+91 98765 43210" does NOT end with "9876543210" as a string, because of
    // the space. Matching in SQL would find nothing here and the check would
    // look like it had run. This is why normalisation happens in JS.
    prismaMock.user.findMany = vi.fn().mockResolvedValue([
      { id: 'u2', name: 'B', phone: '+91 98765 43210', isVerified: false, phoneVerifiedAt: null, _count: { properties: 2 } },
    ])

    const found = await findSharedContactOwners('u1', '09876543210')
    expect(found.accounts.map((a) => a.id)).toEqual(['u2'])
  })

  it('does not match a different number that merely shares digits', async () => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue([
      { id: 'u2', name: 'B', phone: '9876543211', isVerified: false, phoneVerifiedAt: null, _count: { properties: 1 } },
    ])

    await expect(findSharedContactOwners('u1', '9876543210')).resolves.toBeNull()
  })

  it('ignores an account whose stored number is not a usable mobile', async () => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue([
      { id: 'u2', name: 'B', phone: '044 2345 6789', isVerified: false, phoneVerifiedAt: null, _count: { properties: 1 } },
    ])

    await expect(findSharedContactOwners('u1', '9876543210')).resolves.toBeNull()
  })

  it('reports nothing when the number is unique to this owner', async () => {
    prismaMock.user.findMany = vi.fn().mockResolvedValue([])
    await expect(findSharedContactOwners('u1', '9876543210')).resolves.toBeNull()
  })
})
