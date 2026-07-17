/**
 * Admin password floor
 *
 * Guards the gap found 2026-07-17: PATCH /admin/profile/password had no
 * validate() middleware at all, so req.body.newPassword went straight to
 * bcrypt.hash() — a 1-char admin password was accepted, and an omitted one
 * 500'd out of bcrypt. Tenants already had min(8); the highest-privilege
 * account on the platform had nothing.
 */
import { describe, it, expect } from 'vitest'
import { adminChangePasswordSchema, ADMIN_MIN_PASSWORD_LENGTH } from '../src/features/admin/admin.validation.js'

const ok = { currentPassword: 'whatever-the-old-one-is', newPassword: 'a-long-enough-passphrase' }

describe('adminChangePasswordSchema', () => {
  it('accepts a sufficiently long new password', () => {
    expect(adminChangePasswordSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects the one-character password the old route allowed', () => {
    expect(adminChangePasswordSchema.safeParse({ ...ok, newPassword: 'a' }).success).toBe(false)
  })

  it('rejects a missing newPassword instead of 500ing out of bcrypt', () => {
    expect(adminChangePasswordSchema.safeParse({ currentPassword: 'x' }).success).toBe(false)
    expect(adminChangePasswordSchema.safeParse({ ...ok, newPassword: undefined }).success).toBe(false)
  })

  it('rejects a non-string newPassword', () => {
    expect(adminChangePasswordSchema.safeParse({ ...ok, newPassword: 12345678901234 }).success).toBe(false)
  })

  it('requires the current password, so a stolen token alone cannot rotate it', () => {
    expect(adminChangePasswordSchema.safeParse({ newPassword: ok.newPassword }).success).toBe(false)
    expect(adminChangePasswordSchema.safeParse({ ...ok, currentPassword: '' }).success).toBe(false)
  })

  it('enforces a higher floor than the tenant password (8)', () => {
    expect(ADMIN_MIN_PASSWORD_LENGTH).toBeGreaterThan(8)
    const justUnder = 'x'.repeat(ADMIN_MIN_PASSWORD_LENGTH - 1)
    const exactly   = 'x'.repeat(ADMIN_MIN_PASSWORD_LENGTH)
    expect(adminChangePasswordSchema.safeParse({ ...ok, newPassword: justUnder }).success).toBe(false)
    expect(adminChangePasswordSchema.safeParse({ ...ok, newPassword: exactly }).success).toBe(true)
  })
})
