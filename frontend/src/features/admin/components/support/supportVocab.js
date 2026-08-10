/**
 * How a support case is described on screen — words and colours, in one place.
 *
 * The queue, the detail page and the timeline all render the same statuses and
 * priorities. Three copies is how "In progress" becomes "In Progress" on one
 * screen and how an URGENT chip ends up amber in a list and red on the page
 * it opens.
 *
 * Palette rule from `.claude/ui-ux.md`: no raw hex, and the tinted-surface text
 * floor is slate-600, so every pill below uses a -700/-800 text on a -50
 * ground rather than the -500 that passes only on white.
 */

export const STATUS_LABEL = {
  OPEN: 'Open',
  TRIAGED: 'Triaged',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_USER: 'Waiting on requester',
  WAITING_FOR_OWNER: 'Waiting on owner',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

// Only two states are coloured as ATTENTION — escalated and the untouched
// open case. Colouring all eight turns the list into a rainbow where nothing
// stands out, which is the same as colouring none.
export const STATUS_PILL = {
  OPEN: 'bg-brand-50 text-brand-700',
  TRIAGED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-slate-100 text-slate-700',
  WAITING_FOR_USER: 'bg-slate-100 text-slate-600',
  WAITING_FOR_OWNER: 'bg-slate-100 text-slate-600',
  ESCALATED: 'bg-orange-50 text-orange-800',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
}

export const PRIORITY_LABEL = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' }

// NORMAL renders as nothing at all — see PriorityChip. A badge on every row
// saying "normal" is noise that makes the two that are not normal harder to see.
export const PRIORITY_PILL = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: '',
  HIGH: 'bg-amber-50 text-amber-800',
  URGENT: 'bg-red-50 text-red-700',
}

export const TYPE_LABEL = {
  GENERAL_SUPPORT: 'General support',
  PROPERTY_REPORT: 'Property report',
  LISTING_ISSUE: 'Listing issue',
  OWNER_VERIFICATION: 'Verification',
  TENANT_COMPLAINT: 'Tenant complaint',
  APPOINTMENT_ISSUE: 'Appointment',
  CHAT_ISSUE: 'Chat',
  LEASE_ISSUE: 'Lease',
  PAYMENT_ISSUE: 'Payment',
  FRAUD_REPORT: 'Fraud',
  SAFETY_REPORT: 'Safety',
  TECHNICAL_ISSUE: 'Technical',
  ACCOUNT_ISSUE: 'Account',
  OTHER: 'Other',
}

export const VISIBILITY_LABEL = {
  PUBLIC: 'Everyone on this case',
  TENANT_ONLY: 'Requester only',
  OWNER_ONLY: 'Owner only',
  INTERNAL: 'Internal note',
}

/**
 * How a message is tinted by who may read it.
 *
 * An internal note must be UNMISTAKABLE. The spec asks for it to be "clearly
 * visually differentiated", and the failure mode is a moderator typing
 * something about a user into what they think is a private note and it not
 * being one — so internal gets a filled amber card with a left rule, not a
 * subtle border.
 */
export const MESSAGE_TONE = {
  INTERNAL: 'bg-amber-50 border-amber-200 border-l-4',
  PUBLIC: 'bg-white border-slate-200',
  TENANT_ONLY: 'bg-white border-slate-200',
  OWNER_ONLY: 'bg-white border-slate-200',
}

/** 1042 → "SC-1042". Mirrors backend features/support/caseRef.js. */
export const caseRef = (number) => `SC-${number}`

export const AUTHOR_LABEL = {
  TENANT: 'Requester',
  OWNER: 'Owner',
  ADMIN: 'You',
  SUPPORT_AGENT: 'Support',
  SYSTEM: 'System',
}

/** Timeline event → a sentence. `meta` carries the data; this reads it. */
export function describeEvent(event) {
  const m = event.meta ?? {}
  switch (event.type) {
    case 'CASE_CREATED': return 'Case opened'
    case 'REPORT_SUBMITTED': return `Report filed · ${String(m.category ?? '').replace(/_/g, ' ').toLowerCase()}`
    case 'STATUS_CHANGED': return `Status ${STATUS_LABEL[m.from] ?? m.from} → ${STATUS_LABEL[m.to] ?? m.to}`
    case 'PRIORITY_CHANGED': return `Priority ${PRIORITY_LABEL[m.from] ?? m.from} → ${PRIORITY_LABEL[m.to] ?? m.to}`
    case 'CASE_ASSIGNED': return 'Assigned'
    case 'CASE_REASSIGNED': return 'Reassigned'
    case 'MESSAGE_SENT': return `Message sent · ${VISIBILITY_LABEL[m.visibility] ?? m.visibility}`
    case 'INTERNAL_NOTE_ADDED': return 'Internal note added'
    case 'ATTACHMENT_ADDED': return 'Attachment added'
    case 'CASE_ESCALATED': return m.reason ? `Escalated — ${m.reason}` : 'Escalated'
    case 'CASE_RESOLVED': return 'Resolved'
    case 'CASE_CLOSED': return 'Closed'
    case 'EVIDENCE_REQUESTED': return 'Evidence requested'
    case 'OWNER_NOTIFIED': return 'Owner notified'
    case 'OWNER_RESPONDED': return 'Owner responded'
    case 'LISTING_RESTRICTED': return 'Listing restricted'
    // Falls back to the raw type rather than hiding the row: an event this
    // build has not been taught about still happened, and dropping it would
    // put a silent gap in an audit trail.
    default: return String(event.type).replace(/_/g, ' ').toLowerCase()
  }
}
