/**
 * What an admin may do to a listing, by the status it is in now.
 *
 * ONE declared table rather than conditionals in each surface — the same rule
 * `features/spatial/propertyTypes.js` follows, and for the same reason. Two
 * places rendering moderation buttons had already drifted apart: the map popup
 * would let you reinstate a REJECTED listing and reject an ACTIVE one, and the
 * detail view — the page literally called "Review Listings" — offered neither.
 * An admin could undo a mistaken rejection from one screen and not the other.
 *
 * The table mirrors what the SERVER will accept (`admin.service.js`'s
 * `setPropertyStatus`), which refuses ACTIVE from anything but PENDING /
 * SUSPENDED / REJECTED / ACTIVE. Offering a button that 409s is worse than
 * offering none: it reads as the panel being broken rather than as the action
 * being wrong.
 *
 * DRAFT and INACTIVE are deliberately EMPTY. They are the owner's own states —
 * an unfinished listing and one its owner paused — and an admin has no business
 * writing them. That is a decision, not an oversight, which is why
 * `NO_ACTION_REASON` exists: a surface with no buttons must SAY why, or it just
 * looks broken. (It looked broken. That is what prompted this file.)
 */

export const MODERATION_ACTIONS = {
  DRAFT:     [],
  PENDING:   ['approve', 'pause', 'reject'],
  ACTIVE:    ['pause', 'reject'],
  INACTIVE:  [],
  OCCUPIED:  ['pause', 'reject'],
  // "Reinstate", not "Approve" — the listing was live once and we took it down,
  // so the honest verb is undoing our own action.
  SUSPENDED: ['reinstate', 'reject'],
  REJECTED:  ['reinstate'],
}

/** Why a status offers nothing. Absent for every status that offers something. */
export const NO_ACTION_REASON = {
  DRAFT: 'This listing is still a draft. Only its owner can finish and submit it.',
  INACTIVE: 'The owner has paused this listing themselves. Nothing here to moderate.',
}

// The label and the status each action writes. Kept beside the table so a new
// action cannot be added to one and forgotten in the other.
export const ACTION_META = {
  approve:   { label: 'Approve',   status: 'ACTIVE' },
  reinstate: { label: 'Reinstate', status: 'ACTIVE' },
  pause:     { label: 'Pause',     status: 'SUSPENDED' },
  reject:    { label: 'Reject',    status: 'REJECTED' },
}

/**
 * @param {string} status
 * @returns {string[]} action keys, in the order they should be rendered
 *
 * An UNKNOWN status returns nothing rather than everything. A status this file
 * has not been taught about is one nobody has reasoned about, and the safe
 * reading of "I don't know" is "don't offer to change it" — the same
 * fail-closed default `features/support/visibility.js` takes.
 */
export function moderationActionsFor(status) {
  return MODERATION_ACTIONS[status] ?? []
}
