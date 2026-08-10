/**
 * How a case reads to the PERSON who opened it.
 *
 * Deliberately a different vocabulary from the admin panel's. Our queue calls a
 * state `WAITING_FOR_USER`, which is accurate from the inside and useless from
 * the outside — the person waiting needs to read "we need something from you",
 * not our workflow's name for them. Same rows, two audiences, and the admin
 * words live in features/admin/components/support/supportVocab.js.
 */

export const STATUS_COPY = {
  OPEN:              { label: 'Sent — waiting for us to look', tone: 'text-slate-500' },
  TRIAGED:           { label: 'We have read it', tone: 'text-slate-500' },
  IN_PROGRESS:       { label: 'We are working on it', tone: 'text-brand-700' },
  // The one status that asks something of the reader, so it is the one that
  // gets a colour they will notice.
  WAITING_FOR_USER:  { label: 'We need something from you', tone: 'text-amber-800 font-semibold' },
  WAITING_FOR_OWNER: { label: 'Waiting on the owner', tone: 'text-slate-500' },
  // Never "escalated" — an internal word that reads as either alarming or
  // meaningless depending on who you are.
  ESCALATED:         { label: 'With our specialist team', tone: 'text-slate-500' },
  RESOLVED:          { label: 'Resolved', tone: 'text-emerald-700' },
  CLOSED:            { label: 'Closed', tone: 'text-slate-500' },
}

/**
 * What the person is choosing between when they open a request.
 *
 * These are the CASE TYPES, in the words somebody with a problem would use.
 * PROPERTY_REPORT is absent on purpose: reporting a listing happens on the
 * listing, where we can capture which one and run the risk checks. Offering it
 * here would be a second, weaker door with none of that.
 */
export const CATEGORY_LABEL = {
  GENERAL_SUPPORT: 'General question',
  PROPERTY_REPORT: 'Report about a listing',
  LISTING_ISSUE: 'Problem with a listing',
  OWNER_VERIFICATION: 'Verification',
  TENANT_COMPLAINT: 'Complaint',
  APPOINTMENT_ISSUE: 'A visit',
  CHAT_ISSUE: 'Messages',
  LEASE_ISSUE: 'Lease or agreement',
  PAYMENT_ISSUE: 'Money',
  FRAUD_REPORT: 'Something looks fraudulent',
  SAFETY_REPORT: 'Safety',
  TECHNICAL_ISSUE: 'The app or website',
  ACCOUNT_ISSUE: 'My account',
  OTHER: 'Something else',
}

/**
 * What each hat is offered, in the order somebody would look for it.
 *
 * Different lists, because the problems differ: a renter has no verification to
 * ask about and an owner is not chasing a visit they requested. Ordered by how
 * often each is likely rather than alphabetically — a list sorted by the
 * alphabet is sorted by nothing the reader cares about.
 */
export const TENANT_CATEGORIES = [
  'LISTING_ISSUE', 'APPOINTMENT_ISSUE', 'CHAT_ISSUE', 'LEASE_ISSUE',
  'PAYMENT_ISSUE', 'SAFETY_REPORT', 'FRAUD_REPORT', 'ACCOUNT_ISSUE',
  'TECHNICAL_ISSUE', 'GENERAL_SUPPORT', 'OTHER',
]

export const OWNER_CATEGORIES = [
  'LISTING_ISSUE', 'OWNER_VERIFICATION', 'TENANT_COMPLAINT', 'APPOINTMENT_ISSUE',
  'LEASE_ISSUE', 'PAYMENT_ISSUE', 'CHAT_ISSUE', 'ACCOUNT_ISSUE',
  'TECHNICAL_ISSUE', 'GENERAL_SUPPORT', 'OTHER',
]

/** 1042 → "SC-1042". Mirrors backend features/support/caseRef.js. */
export const caseRef = (number) => `SC-${number}`

/** Who wrote a message, from the reader's side. */
export const authorName = (message, myUserId) => {
  if (message.authorRole === 'TENANT' || message.authorRole === 'OWNER') {
    return message.authorUser?.id === myUserId ? 'You' : 'Them'
  }
  // Staff are always the product, never a person. Which individual handled a
  // case is not something a user needs and is something a determined person
  // could act on.
  return 'StayOnMap'
}
