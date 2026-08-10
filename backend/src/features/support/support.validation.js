import { z } from 'zod'

// The vocabularies, restated for Zod. Kept in sync with schema.prisma by
// tests/support-contract.test.js — the amenities lesson: a list duplicated
// across files drifts silently unless something compares them.
export const CASE_TYPES = [
  'GENERAL_SUPPORT', 'PROPERTY_REPORT', 'LISTING_ISSUE', 'OWNER_VERIFICATION',
  'TENANT_COMPLAINT', 'APPOINTMENT_ISSUE', 'CHAT_ISSUE', 'LEASE_ISSUE',
  'PAYMENT_ISSUE', 'FRAUD_REPORT', 'SAFETY_REPORT', 'TECHNICAL_ISSUE',
  'ACCOUNT_ISSUE', 'OTHER',
]

export const CASE_STATUSES = [
  'OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_OWNER',
  'ESCALATED', 'RESOLVED', 'CLOSED',
]

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
export const VISIBILITIES = ['PUBLIC', 'TENANT_ONLY', 'OWNER_ONLY', 'INTERNAL']

/**
 * What a USER may open a case with.
 *
 * PROPERTY_REPORT is deliberately absent from this list even though it is a
 * real case type: a report is filed through POST /properties/:id/reports, which
 * runs the risk score, the auto-suspend corroboration rule and the owner
 * notification. Letting somebody create a PROPERTY_REPORT case directly would
 * be a second, weaker door into moderation that skips all three.
 *
 * There is no `priority` and no `status` field. Priority is staff's to set — a
 * field anyone can mark URGENT is URGENT on everything within a week — and a
 * case always starts OPEN.
 */
const USER_CASE_TYPES = CASE_TYPES.filter((t) => t !== 'PROPERTY_REPORT')

export const createCaseSchema = z.object({
  type: z.enum(USER_CASE_TYPES),
  // Long enough to be a sentence, short enough to be a subject line.
  subject: z.string().trim().min(3).max(140),
  // 20, matching a property report's floor: a request nobody can act on wastes
  // the requester's time more than ours, since it comes back as a question.
  description: z.string().trim().min(20).max(4000),

  // Context the app already knows. Optional, and never trusted — the service
  // checks that the caller may actually reference each one.
  relatedPropertyId: z.string().trim().max(64).optional(),
  relatedAppointmentId: z.string().trim().max(64).optional(),
  relatedConversationId: z.string().trim().max(64).optional(),
  relatedLeaseId: z.string().trim().max(64).optional(),
})

export const caseMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  // Only staff routes read this; the service clamps it to what the author's
  // role is allowed regardless, so a user sending it is ignored rather than
  // rejected — a 400 here would leak that the field exists at all.
  visibility: z.enum(VISIBILITIES).optional(),
})

export const attachmentSchema = z.object({
  // A URL our own uploader returned. The upload itself goes through
  // POST /uploads/*, which owns the mime allowlist, the size cap and the
  // randomUUID path — this only records the result, so it must not become a
  // second way to attach an arbitrary remote URL to a case.
  url: z.string().url().max(600),
  fileName: z.string().trim().max(200).optional(),
  mimeType: z.string().trim().max(120),
  sizeBytes: z.number().int().min(0).max(50_000_000).optional(),
  messageId: z.string().trim().max(64).optional(),
})

// ── Staff ──────────────────────────────────────────────────────────────────

export const adminCaseListQuerySchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  type: z.enum(CASE_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToId: z.string().trim().max(64).optional(),
  unassigned: z.coerce.boolean().optional(),
  city: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  // Capped, not trusted: this table grows with every request, and an unbounded
  // page size from a query string is how an admin panel gets slow.
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const statusChangeSchema = z.object({
  status: z.enum(CASE_STATUSES),
  reason: z.string().trim().max(500).optional(),
})

export const prioritySchema = z.object({ priority: z.enum(PRIORITIES) })

// Nullable, because unassigning is a real action — a case handed back to the
// queue is not the same as one nobody has looked at, and the timeline records
// which it was.
export const assignSchema = z.object({ assignedToId: z.string().trim().max(64).nullable() })

export const escalateSchema = z.object({
  // REQUIRED, unlike every other reason field here. An escalation with no
  // reason is a status change wearing a louder name — the whole point is to
  // tell the next person what they are being asked to look at.
  reason: z.string().trim().min(5).max(500),
})
