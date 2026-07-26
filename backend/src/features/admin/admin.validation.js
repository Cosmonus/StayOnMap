import { z } from 'zod'
import { filterQueryShape, ADMIN_FILTERS } from '../properties/filters.registry.js'

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// The admin property/pins endpoints had NO query validation at all — raw
// req.query reached Prisma, so `status` went in unchecked and a malformed
// bbox arrived as NaN. They now share the public map's filter registry
// (plus admin-only status/riskLevel), which brings validation with it.
//
// Bounds are optional here, unlike the public pinsQuerySchema: the admin map
// fetches once before its first `idle` event, and the table has no viewport at
// all. Same clamp as the public side — a viewport containing India is valid,
// so corners are clamped rather than rejected.
const clampedTo = (min, max) => z.coerce.number().transform((n) => Math.min(Math.max(n, min), max))

export const adminPinsQuerySchema = z.object({
  swLat: clampedTo(6, 38).optional(),
  swLng: clampedTo(68, 98).optional(),
  neLat: clampedTo(6, 38).optional(),
  neLng: clampedTo(68, 98).optional(),
  ...filterQueryShape(ADMIN_FILTERS),
})

// Note: no pricingModel default here, unlike the public schemas — moderation
// must see rent AND lease listings by default. filterQueryShape leaves it
// optional, so absent = both modes. Same principle as status having no ACTIVE
// default: admin's read path is deliberately unfiltered.
export const adminPropertiesQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  ...filterQueryShape(ADMIN_FILTERS),
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

// PATCH /admin/properties/:id/status had NO schema — req.body.status went
// straight into prisma.property.update(), so a typo 500'd out of Prisma and
// any PropertyStatus was reachable, including DRAFT (which would yank a live
// listing back to an unfinished state nobody asked for).
//
// The set is deliberately narrower than PropertyStatus. An admin moderates:
// approve, pause, reject. Creating and deleting a listing belongs to the
// owner, and DRAFT/INACTIVE/OCCUPIED are the OWNER's states — an admin
// writing them would be editing someone's listing rather than policing it.
export const ADMIN_PROPERTY_STATUSES = ['ACTIVE', 'SUSPENDED', 'REJECTED']

// A pause or a rejection has to carry its reason: the owner is told exactly
// this text, and it is what the activity log preserves afterwards. An
// unexplained takedown is indistinguishable from a bug to the person it
// happens to.
export const adminPropertyStatusSchema = z.object({
  status: z.enum(ADMIN_PROPERTY_STATUSES),
  note: z.string().trim().max(500).optional(),
}).refine(
  (v) => v.status === 'ACTIVE' || (v.note?.length ?? 0) >= 5,
  { path: ['note'], message: 'Tell the owner why — this reason is sent to them' },
)
