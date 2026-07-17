/**
 * requireCompleteProfile — owners must be reachable before they can list.
 *
 * The gate exists because a listing is a stranger's home search: if the person
 * behind it has no name, no verified email and no phone, a tenant has no one to
 * hold accountable and no way to reach them. It is CREATION-only on purpose —
 * gating edits would strand owners who listed before the rule existed.
 *
 * What it must never become: a checklist of every column on User. Refusing
 * someone's listing over a missing avatar or bio blocks honest owners without
 * making a single renter safer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { requireCompleteProfile, missingProfileFields } from '../src/middlewares/requireCompleteProfile.middleware.js'

const complete = { name: 'Asha R', phone: '9876543210', city: 'Chennai', isVerified: true }

function res() {
  const r = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}

beforeEach(() => vi.clearAllMocks())

describe('missingProfileFields', () => {
  it('passes a complete profile', () => {
    expect(missingProfileFields(complete)).toEqual([])
  })

  it('treats a missing user as entirely incomplete rather than complete', () => {
    // Fail closed: a lookup that returns nothing must never read as "fine".
    expect(missingProfileFields(null).length).toBe(4)
  })

  it('rejects an unverified email — typing an address is not being reachable', () => {
    expect(missingProfileFields({ ...complete, isVerified: false }))
      .toEqual([{ field: 'email', label: 'Verified email' }])
  })

  it('treats whitespace as missing', () => {
    const m = missingProfileFields({ ...complete, name: '   ', phone: '  ' })
    expect(m.map((x) => x.field)).toEqual(['name', 'phone'])
  })

  it('names every missing field so the client can route them to it', () => {
    const m = missingProfileFields({ name: 'Asha R', phone: null, city: null, isVerified: false })
    expect(m.map((x) => x.field)).toEqual(['phone', 'city', 'email'])
  })

  // The barrier stays where it was justified. Adding to it is a product
  // decision, not a tidy-up — this test is here to make that deliberate.
  it('does not require avatar, bio or social links', () => {
    const bare = { ...complete, avatarUrl: null, bio: null, socialLinks: null }
    expect(missingProfileFields(bare)).toEqual([])
  })
})

describe('requireCompleteProfile middleware', () => {
  it('calls next() for a complete profile', async () => {
    prismaMock.user.findUnique.mockResolvedValue(complete)
    const next = vi.fn()
    await requireCompleteProfile({ user: { id: 'u1' } }, res(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('403s PROFILE_INCOMPLETE and lists what is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...complete, phone: null })
    const r = res()
    const next = vi.fn()

    await requireCompleteProfile({ user: { id: 'u1' } }, r, next)

    expect(next).not.toHaveBeenCalled()
    expect(r.status).toHaveBeenCalledWith(403)
    const body = r.json.mock.calls[0][0]
    expect(body.error).toBe('PROFILE_INCOMPLETE')
    expect(body.missing).toEqual([{ field: 'phone', label: 'Phone number' }])
    expect(body.message).toContain('Phone number')
  })

  it('passes DB errors to next() — it must never fall open', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))
    const r = res()
    const next = vi.fn()

    await requireCompleteProfile({ user: { id: 'u1' } }, r, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect(r.status).not.toHaveBeenCalled()
  })
})
