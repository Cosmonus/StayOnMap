/**
 * Who may see what on a support case.
 *
 * This is the single most dangerous file in the support layer, because every
 * mistake in it is a privacy leak rather than an error: the wrong answer here
 * shows an owner the name of the person who reported them, or shows a reporter
 * an internal note saying their listing is under investigation. Both are
 * unrecoverable — you cannot un-deliver a message.
 *
 * So it is pure. No Prisma, no request, no `req.user`. It takes a viewer and a
 * row and returns a boolean, which means it can be exhaustively tested, and it
 * is the ONE place the rules live — the services filter through it and the
 * routes never filter at all.
 */

export const VISIBILITY = {
  PUBLIC: 'PUBLIC',
  TENANT_ONLY: 'TENANT_ONLY',
  OWNER_ONLY: 'OWNER_ONLY',
  INTERNAL: 'INTERNAL',
}

export const ROLE = {
  TENANT: 'TENANT',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  SYSTEM: 'SYSTEM',
}

/** Staff see everything. That is what makes moderation possible. */
export const isStaff = (role) => role === ROLE.ADMIN || role === ROLE.SUPPORT_AGENT

/**
 * A viewer, as this module understands one.
 *
 * @typedef {Object} Viewer
 * @property {'TENANT'|'OWNER'|'ADMIN'|'SUPPORT_AGENT'} role  the hat, not the account type
 * @property {string} [userId]   set for TENANT/OWNER
 * @property {string} [adminId]  set for staff
 */

/**
 * Can this viewer read a message/attachment with this visibility?
 *
 * The table, in full — there are only four values precisely so it fits in
 * one's head:
 *
 *              PUBLIC  TENANT_ONLY  OWNER_ONLY  INTERNAL
 *   TENANT       yes       yes          no         no
 *   OWNER        yes       no           yes        no
 *   staff        yes       yes          yes        yes
 */
export function canSee(viewer, visibility) {
  if (!viewer?.role) return false
  if (isStaff(viewer.role)) return true

  switch (visibility) {
    case VISIBILITY.PUBLIC:
      return viewer.role === ROLE.TENANT || viewer.role === ROLE.OWNER
    case VISIBILITY.TENANT_ONLY:
      return viewer.role === ROLE.TENANT
    case VISIBILITY.OWNER_ONLY:
      return viewer.role === ROLE.OWNER
    case VISIBILITY.INTERNAL:
      return false
    default:
      // An unknown visibility is treated as INTERNAL, not as PUBLIC. A value
      // this file has not been taught about is one nobody has reasoned about,
      // and the safe reading of "I don't know" is "don't show it".
      return false
  }
}

/** Filter a list of rows carrying `visibility`. The only way services read. */
export const visibleTo = (viewer, rows) => (rows ?? []).filter((r) => canSee(viewer, r.visibility))

/**
 * What a party's own message defaults to, by the hat they wrote it in.
 *
 * A tenant writing on a PROPERTY_REPORT case is telling us something about
 * somebody else's listing — that must never default to PUBLIC, where PUBLIC
 * includes the owner. The reverse is equally true of an owner's response.
 *
 * On a case with no counterparty (a GENERAL_SUPPORT request), TENANT_ONLY and
 * PUBLIC are the same set of people, so the narrow default costs nothing and
 * stays correct if a counterparty is ever added to the case later.
 */
export function defaultVisibilityFor(role) {
  if (role === ROLE.OWNER) return VISIBILITY.OWNER_ONLY
  if (isStaff(role)) return VISIBILITY.INTERNAL
  return VISIBILITY.TENANT_ONLY
}

/**
 * Which visibilities a given author is ALLOWED to choose.
 *
 * Users get no choice at all — a tenant cannot publish to an owner, and letting
 * them pick would be a way to leak their own identity into a case the owner can
 * read. Staff choose deliberately, which is the whole point of an internal note.
 */
export function allowedVisibilities(role) {
  if (isStaff(role)) return [VISIBILITY.PUBLIC, VISIBILITY.TENANT_ONLY, VISIBILITY.OWNER_ONLY, VISIBILITY.INTERNAL]
  return [defaultVisibilityFor(role)]
}

/**
 * The hat a user holds on a specific case — or null, which means no access.
 *
 * Deliberately NOT `user.role`: an OWNER account reporting somebody else's
 * listing is a TENANT here, and treating them as an owner would hand them the
 * owner's side of a case filed against a stranger.
 *
 * @param {{ createdById: string|null, openedAs: string, relatedUserId: string|null }} supportCase
 * @param {string} userId
 * @param {string|null} [relatedPropertyOwnerId] owner of the case's property, when loaded
 */
export function partyRole(supportCase, userId, relatedPropertyOwnerId = null) {
  if (!userId || !supportCase) return null

  // The person who opened it holds the hat they opened it with. Checked FIRST:
  // an owner who reports a rival's listing is both `createdById` and, on some
  // other case, an owner — and on THIS case they are the reporter.
  if (supportCase.createdById === userId) return supportCase.openedAs

  // The owner of the listing a case is about is a party to it, but only ever
  // as OWNER — which is what keeps TENANT_ONLY messages away from them.
  if (relatedPropertyOwnerId && relatedPropertyOwnerId === userId) return ROLE.OWNER

  // `relatedUserId` is the person a case is ABOUT (a complaint against them).
  // They are deliberately NOT a party: being the subject of a complaint does
  // not entitle you to read it, and moderation decides what they are told.
  return null
}
