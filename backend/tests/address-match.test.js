// The document-vs-listing address comparison.
//
// The rule under test, everywhere: text comparison may GRADE a match but only a
// pincode contradiction may ACCUSE. "Your document doesn't match" aimed at an
// owner mid-verification, on the strength of spelling differences, is the same
// sin as a false pincode flag — so a low overlap alone is never a 'mismatch'.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { compareAddresses, extractPincode, addressTokens } from '../src/features/verification/addressMatch.js'
import { resetPincodeCache } from '../src/features/spatial/pincodeProvider.js'

const LISTING = {
  address: '12/4, 3rd Cross, Koramangala 6th Block',
  pincode: '560095',
  city: 'Bengaluru',
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPincodeCache()
  prismaMock.pincodeDirectory = {
    count: vi.fn().mockResolvedValue(155_000),
    findMany: vi.fn().mockResolvedValue([
      { officeName: 'Koramangala VI Bk S.O', officeType: 'S.O', district: 'Bengaluru', state: 'KARNATAKA', taluk: null },
    ]),
  }
})

describe('extractPincode', () => {
  it('finds a pincode inside an address, and knows none start with 0', () => {
    expect(extractPincode('No 4, MG Road, Bengaluru 560095, India')).toBe('560095')
    expect(extractPincode('house number 012345')).toBeNull()
    expect(extractPincode('')).toBeNull()
  })
})

describe('addressTokens', () => {
  it('makes Indian address spelling variants comparable', () => {
    // "3rd Cross Rd" and "Third Cross Road" are the same street.
    const a = addressTokens('12/4, 3rd Cross Rd, Koramangala 6th Block')
    const b = addressTokens('No 12/4, Third Cross Road, Koramangala VI Block')
    for (const t of a) if (!['12', '4'].includes(t)) expect(b).toContain(t)
  })

  it('drops the pincode — it is compared separately, exactly', () => {
    expect(addressTokens('MG Road 560095')).not.toContain('560095')
  })
})

describe('compareAddresses', () => {
  it('returns null when nothing was declared — absence is not a verdict', async () => {
    expect(await compareAddresses(LISTING, '')).toBeNull()
    expect(await compareAddresses(LISTING, null)).toBeNull()
  })

  it('matches the same address in a different spelling', async () => {
    const r = await compareAddresses(LISTING, 'No 12/4, Third Cross Road, Koramangala VI Block, Bengaluru 560095')
    expect(r.verdict).toBe('match')
    expect(r.pincode.match).toBe(true)
  })

  it('calls a pincode contradiction a mismatch — the one hard accusation', async () => {
    // Two different pincodes cannot both be printed on the same property's
    // paperwork by accident of spelling.
    const r = await compareAddresses(LISTING, '12/4, 3rd Cross, Koramangala 6th Block, 600028')
    expect(r.verdict).toBe('mismatch')
    expect(r.pincode).toEqual({ listing: '560095', document: '600028', match: false })
    expect(r.notes[0]).toMatch(/600028/)
  })

  it('never calls low text overlap alone a mismatch', async () => {
    // Same pincode, completely different text: graded 'partial', with a note
    // that says "worth reading" — not "wrong".
    const r = await compareAddresses(LISTING, 'Survey no 88, Green Meadows Layout, 560095')
    expect(r.verdict).toBe('partial')
    expect(r.notes[0]).toMatch(/can be legitimate/i)
  })

  it('tells the reviewer where the DOCUMENT pincode is', async () => {
    const r = await compareAddresses(LISTING, 'No 12/4, Third Cross Road, Koramangala VI Block, 560095')
    expect(r.documentPincodeArea).toEqual({ state: 'KARNATAKA', districts: ['Bengaluru'] })
  })

  it('declares too-short addresses not comparable rather than guessing', async () => {
    const r = await compareAddresses({ address: 'Flat 2', pincode: null }, 'my house')
    expect(r.verdict).toBe('not_comparable')
  })

  it('survives the pincode directory being down — comparison still runs', async () => {
    prismaMock.pincodeDirectory.count.mockRejectedValue(new Error('db down'))
    const r = await compareAddresses(LISTING, 'No 12/4, Third Cross Road, Koramangala VI Block, 560095')
    expect(r.verdict).toBe('match')
    expect(r.documentPincodeArea).toBeNull()
  })
})
