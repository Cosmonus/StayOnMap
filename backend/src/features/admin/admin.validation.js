import { z } from 'zod'
export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// PATCH /admin/profile/password had NO schema — req.body.newPassword went
// straight to bcrypt.hash(), so a one-character admin password was accepted
// (and an omitted one threw a 500 out of bcrypt). Tenants already got
// min(8) via resetPasswordSchema, leaving the platform's highest-privilege
// account the least protected.
//
// 12, not 8: this account moderates every listing, blocks users, and can read
// any chat transcript — and unlike a tenant it has no email-reset path to
// recover from a weak choice.
//
// Exported so scripts/update-admin.js and prisma/seed.js enforce the same
// floor. They're the other two ways an admin password gets set, and gating
// only the API would leave the CLI paths able to reinstate a weak one.
export const ADMIN_MIN_PASSWORD_LENGTH = 12

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(
    ADMIN_MIN_PASSWORD_LENGTH,
    `Admin password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters`
  ),
})
