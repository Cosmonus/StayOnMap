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
