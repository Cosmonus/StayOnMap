import * as service from './supportCase.service.js'
import { ok, created } from '../../utils/response.js'
import { ROLE } from './visibility.js'
import * as knowledge from './knowledge.service.js'
import * as evidence from '../uploads/evidence.service.js'

/**
 * HTTP only. Every authorisation decision is in the service, where it is a
 * QUERY rather than a check — a controller that filtered would be a second
 * place for the rules to live and a second place to forget them.
 */

/**
 * Which hat a request is wearing.
 *
 * The client says, and it is safe for it to: the hat only ever NARROWS what
 * comes back. Asking for the owner list gives you cases about listings you own,
 * which is checked against `relatedProperty.ownerId` server-side — claiming to
 * be an owner when you are not returns nothing rather than somebody else's
 * cases.
 */
const hatOf = (req) => (req.query.hat === 'OWNER' || req.body?.hat === 'OWNER' ? ROLE.OWNER : ROLE.TENANT)

const asUser = (req) => ({ role: hatOf(req), userId: req.user.id })
// `req.admin.sub`, not `.id` — the admin JWT payload is left un-normalised on
// purpose (see .claude/auth.md); copying the user middleware's shape here is a
// known way to get `undefined` in an accountability column.
const asStaff = (req) => ({ role: ROLE.ADMIN, adminId: req.admin.sub })

// ── User ───────────────────────────────────────────────────────────────────

export async function listMine(req, res, next) {
  try { ok(res, await service.listCasesForUser(req.user.id, { hat: hatOf(req) })) } catch (err) { next(err) }
}

export async function getMine(req, res, next) {
  try { ok(res, await service.getCaseForUser(req.params.id, req.user.id)) } catch (err) { next(err) }
}

// Both hats, always — the mode you are NOT in has to be able to say something
// is waiting over there, or splitting the list by hat hides it everywhere.
export async function unread(req, res, next) {
  try { ok(res, await service.unreadCountsForUser(req.user.id)) } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    created(res, await service.createCaseForUser(req.user.id, req.body, { hat: hatOf(req) }))
  } catch (err) { next(err) }
}

export async function reply(req, res, next) {
  try {
    // No visibility argument: the service clamps a user to the single value
    // their hat allows, so passing one would only look like it did something.
    created(res, await service.addMessage(req.params.id, asUser(req), req.body.body))
  } catch (err) { next(err) }
}

export async function attach(req, res, next) {
  try { created(res, await service.addAttachment(req.params.id, asUser(req), req.body)) } catch (err) { next(err) }
}

/**
 * The requester agrees it is done.
 *
 * The ONE transition a user may make, and only to CLOSED on a case that support
 * has already RESOLVED — everything else is staff's. Confirming a resolution is
 * the person's own business; deciding a case is resolved is not.
 */
export async function closeMine(req, res, next) {
  try {
    const found = await service.getCaseForUser(req.params.id, req.user.id)
    ok(res, await service.changeStatus(found.id, 'CLOSED', { role: hatOf(req), userId: req.user.id }, { reason: 'confirmed by requester' }))
  } catch (err) { next(err) }
}

// ── Staff ──────────────────────────────────────────────────────────────────

export async function adminList(req, res, next) {
  try { ok(res, await service.adminListCases(req.query)) } catch (err) { next(err) }
}

export async function adminCounts(_req, res, next) {
  try { ok(res, await service.adminCaseCounts()) } catch (err) { next(err) }
}

export async function adminAssignees(_req, res, next) {
  try { ok(res, await service.listAssignees()) } catch (err) { next(err) }
}

export async function adminGet(req, res, next) {
  try { ok(res, await service.adminGetCase(req.params.id)) } catch (err) { next(err) }
}

export async function adminReply(req, res, next) {
  try {
    created(res, await service.addMessage(req.params.id, asStaff(req), req.body.body, req.body.visibility))
  } catch (err) { next(err) }
}

export async function adminAttach(req, res, next) {
  try { created(res, await service.addAttachment(req.params.id, asStaff(req), req.body)) } catch (err) { next(err) }
}

/**
 * Upload a file and attach it, in one call.
 *
 * `visibility` rides on the multipart body as a plain field, so it cannot go
 * through `validate()` (which runs before multer has parsed anything). The
 * service clamps it against `allowedVisibilities` regardless — the same clamp
 * that protects every other write here — so an unrecognised value lands on the
 * staff default of INTERNAL rather than anywhere wider.
 */
export async function adminUpload(req, res, next) {
  try {
    const stored = await evidence.uploadEvidence(req.file, req.admin.sub, 'support-staff')
    created(res, await service.addAttachment(req.params.id, asStaff(req), {
      ...stored,
      visibility: req.body?.visibility,
    }))
  } catch (err) { next(err) }
}

export async function adminSetStatus(req, res, next) {
  try {
    ok(res, await service.changeStatus(req.params.id, req.body.status, asStaff(req), { reason: req.body.reason }))
  } catch (err) { next(err) }
}

export async function adminSetPriority(req, res, next) {
  try { ok(res, await service.setPriority(req.params.id, req.body.priority, asStaff(req))) } catch (err) { next(err) }
}

export async function adminAssign(req, res, next) {
  try { ok(res, await service.assignCase(req.params.id, req.body.assignedToId, asStaff(req))) } catch (err) { next(err) }
}

export async function adminEscalate(req, res, next) {
  try { ok(res, await service.escalateCase(req.params.id, asStaff(req), req.body.reason)) } catch (err) { next(err) }
}

// ── Help centre ────────────────────────────────────────────────────────────
// Public reads, but behind authMiddleware like the rest of this router: the
// articles are about using an account, and there is no anonymous surface that
// needs them. Making them public would be a separate decision with its own SEO
// consequences (see .claude/seo.md on what is deliberately not indexed).
export async function articles(req, res, next) {
  try {
    ok(res, {
      categories: await knowledge.listCategories(),
      articles: await knowledge.listArticles({ hat: hatOf(req), ...req.query }),
    })
  } catch (err) { next(err) }
}
