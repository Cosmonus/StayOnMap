import { z } from 'zod'

// `markAllRead` did `if (type) where.type = type`, passing a caller-supplied
// string straight into a Prisma enum column — so `?type=BOGUS` threw and
// returned 500.
//
// Note why this is validated rather than ignored. `audienceFilter` safely
// drops an unrecognised audience and falls back to "no filter", which is the
// right call for a READ. Doing the same for `type` on **read-all** would be
// dangerous in the opposite direction: a typo'd filter would silently widen
// the write from "mark this category read" to "mark EVERYTHING read", with no
// undo. A 400 is the only safe answer for a filter that scopes a mutation.
//
// Kept in sync with `enum NotificationType` in schema.prisma by
// `tests/notification-type-parity.test.js` — the amenities lesson: a
// vocabulary duplicated across files drifts silently unless a test compares
// them.
export const NOTIFICATION_TYPES = [
  'APPOINTMENT_REQUEST',
  'APPOINTMENT_STATUS',
  'APPOINTMENT_ACCEPTED',
  'APPOINTMENT_REJECTED',
  'REPORT_SUBMITTED',
  'REPORT_UPDATE',
  'VERIFICATION_UPDATE',
  'TRUST_ALERT',
  'LEASE_OFFERED',
  'LEASE_SIGNED',
  'LEASE_REJECTED',
  'SYSTEM',
  'MESSAGE',
  // Support & Trust (2026-08-10). Three DELIVERY categories, not one per event
  // — SupportEvent is the log of what happened; these decide push and email
  // routing (notifications.service.js's PUSH_TYPES).
  'SUPPORT_CASE_MESSAGE',
  'SUPPORT_CASE_UPDATE',
  'SUPPORT_CASE_RESOLVED',
]

const audience = z.enum(['TENANT', 'OWNER']).optional()

export const notificationListQuerySchema = z.object({
  audience,
})

export const markAllReadQuerySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  audience,
})
