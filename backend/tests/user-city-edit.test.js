/**
 * City editing in Settings — 2026-07-22.
 *
 * City is captured at signup and city-gates registration, so updateUser only
 * accepts a SUPPORTED_CITIES value: a user who signed up before city was
 * required (or via a social-login edge case) can fill it in from Settings, but
 * an unsupported city or arbitrary text is silently dropped — the same invalid-
 * value handling the visibility fields use. Without this, the hosting profile
 * gate (which requires city) was unreachable for a null-city user.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/features/points/points.service.js', () => ({ awardPoints: vi.fn() }))
vi.mock('../src/features/auth/auth.service.js', () => ({
  requestPasswordReset: vi.fn(),
  stripPasswordHash: (u) => u,
}))

const { updateUser } = await import('../src/features/users/users.service.js')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data }))
  prismaMock.user.findUnique.mockResolvedValue({ phone: '9876543210' })
})

function updatedCity() {
  return prismaMock.user.update.mock.calls[0][0].data.city
}

describe('updateUser — city', () => {
  it('saves a supported city', async () => {
    await updateUser('u1', { city: 'Chennai' })
    expect(updatedCity()).toBe('Chennai')
  })

  it('drops an unsupported city rather than persisting garbage', async () => {
    await updateUser('u1', { city: 'Goa' })
    expect(updatedCity()).toBeUndefined()
  })

  it('drops arbitrary text', async () => {
    await updateUser('u1', { city: '"; DROP TABLE users; --' })
    expect(updatedCity()).toBeUndefined()
  })

  it('leaves city untouched when the update omits it', async () => {
    await updateUser('u1', { name: 'Asha' })
    expect('city' in prismaMock.user.update.mock.calls[0][0].data).toBe(false)
  })
})

/**
 * Added 2026-08-07 with phone verification. The badge belongs to a NUMBER, not
 * to an account — so editing the number here has to drop it. Miss this and
 * anyone verifies one SIM, swaps in any number they like, and keeps the tick;
 * the verification survives the only thing it was ever evidence about.
 */
describe('updateUser — phone changes drop the verification', () => {
  const written = () => prismaMock.user.update.mock.calls[0][0].data

  it('clears phoneVerifiedAt when the number actually changes', async () => {
    await updateUser('u1', { phone: '9000000000' })
    expect(written().phoneVerifiedAt).toBeNull()
  })

  it('keeps the verification when the number is re-saved unchanged', async () => {
    // Settings sends every field on save, so an unrelated edit posts the same
    // phone back. Treating that as a change would un-verify people for editing
    // their bio.
    await updateUser('u1', { phone: '9876543210', bio: 'new bio' })
    expect('phoneVerifiedAt' in written()).toBe(false)
  })

  it('leaves the verification alone when phone is not part of the update', async () => {
    await updateUser('u1', { name: 'Asha' })
    expect('phoneVerifiedAt' in written()).toBe(false)
  })

  it('clears it when the number is removed entirely', async () => {
    await updateUser('u1', { phone: '' })
    expect(written().phoneVerifiedAt).toBeNull()
  })
})
