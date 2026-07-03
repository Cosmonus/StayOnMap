/**
 * Auth service tests
 *
 * What each suite guards against:
 *   registerUser   — cities outside SUPPORTED_CITIES never get a User row,
 *                    only a WaitlistEntry; duplicate email is rejected
 *   updateUserRole — role upgrade is one-way (TENANT → OWNER only): rejects
 *                    any target other than OWNER, and rejects re-upgrading
 *                    an existing OWNER
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

import { registerUser, updateUserRole } from '../src/features/auth/auth.service.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerUser', () => {
  it('waitlists a signup from a city outside SUPPORTED_CITIES instead of creating a User', async () => {
    prismaMock.waitlistEntry.create.mockResolvedValue({ id: 'wait-1' })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Goa' })

    expect(result).toEqual({ waitlisted: true })
    expect(prismaMock.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: 'Goa' }) })
    )
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('throws 409 when the email is already registered in a supported city', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })

    await expect(
      registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Chennai' })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('creates a TENANT by default for a supported city', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', name: 'Test', city: 'Chennai', role: 'TENANT', passwordHash: 'hashed',
    })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Chennai' })

    expect(result.user.role).toBe('TENANT')
    expect(result.user.passwordHash).toBeUndefined() // never leak the hash to the caller
    expect(result.token).toBeTypeOf('string')
  })
})

describe('updateUserRole', () => {
  it('rejects any target role other than OWNER', async () => {
    await expect(updateUserRole('user-1', 'TENANT')).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('throws 404 when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(updateUserRole('user-1', 'OWNER')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when the user is already an OWNER (no re-upgrade)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'OWNER' })

    await expect(updateUserRole('user-1', 'OWNER')).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('upgrades a TENANT to OWNER', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'TENANT' })
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', role: 'OWNER', passwordHash: 'hashed' })

    const result = await updateUserRole('user-1', 'OWNER')

    expect(result.role).toBe('OWNER')
    expect(result.passwordHash).toBeUndefined()
  })
})
