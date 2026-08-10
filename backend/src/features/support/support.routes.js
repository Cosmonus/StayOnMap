import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import {
  createCaseSchema, caseMessageSchema, attachmentSchema,
  adminCaseListQuerySchema, statusChangeSchema, prioritySchema,
  assignSchema, escalateSchema,
} from './support.validation.js'
import * as ctrl from './support.controller.js'

/**
 * Support cases.
 *
 * Two routers, two auth systems, and nothing shared between them but the
 * service — the same separation the rest of the platform keeps between `api`
 * and `adminApi` (`.claude/auth.md`). Every read is scoped inside the service
 * by the caller's id; no route filters anything, so there is one place the
 * rules live.
 */

// ── User ───────────────────────────────────────────────────────────────────
export const supportRouter = Router()
supportRouter.use(authMiddleware)

supportRouter.get('/articles', ctrl.articles)
// Before `/cases/:id`, or "unread" is read as a case id — the same trap the
// admin router's /cases/counts sits above.
supportRouter.get('/cases/unread', ctrl.unread)
supportRouter.get('/cases', ctrl.listMine)
supportRouter.get('/cases/:id', ctrl.getMine)

// strictLimiter on the two writes that create rows: opening a case and
// attaching a file. Replying is deliberately NOT strict-limited — it is a
// conversation, and 20 messages per 15 minutes is a real ceiling for somebody
// answering questions during an incident. Same reasoning as chatLimiter
// guarding the send rather than the whole chat router.
supportRouter.post('/cases', strictLimiter, validate(createCaseSchema), ctrl.create)
supportRouter.post('/cases/:id/messages', validate(caseMessageSchema), ctrl.reply)
supportRouter.post('/cases/:id/attachments', strictLimiter, validate(attachmentSchema), ctrl.attach)
supportRouter.post('/cases/:id/close', ctrl.closeMine)

// Same shape as /uploads/support-file's: every type, no fileFilter, 25MB.
// evidence.service.js decides what may render, from the bytes — see its header.
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

// ── Staff ──────────────────────────────────────────────────────────────────
export const adminSupportRouter = Router()
adminSupportRouter.use(adminAuthMiddleware)

// Not under /cases at all — it is a list of people, not of cases.
adminSupportRouter.get('/assignees', ctrl.adminAssignees)

// Before `/cases/:id`, or "counts" is read as a case id.
adminSupportRouter.get('/cases/counts', ctrl.adminCounts)
adminSupportRouter.get('/cases', validate(adminCaseListQuerySchema, 'query'), ctrl.adminList)
adminSupportRouter.get('/cases/:id', ctrl.adminGet)

adminSupportRouter.post('/cases/:id/messages', validate(caseMessageSchema), ctrl.adminReply)
adminSupportRouter.post('/cases/:id/attachments', validate(attachmentSchema), ctrl.adminAttach)
// Multipart, and the ONE upload route behind an admin JWT.
//
// /uploads/* is all `authMiddleware` — a USER token — so before this, staff
// could record an attachment URL and had no way to produce one. A general
// /admin/uploads router would be a new mount and a new surface for exactly one
// consumer; evidence on a case is the only thing an admin uploads.
//
// Upload and attach in ONE call rather than the user side's two: there is no
// storage-prefix guard to justify a separate record step when the same request
// just wrote the file.
adminSupportRouter.post('/cases/:id/upload', evidenceUpload.single('file'), ctrl.adminUpload)
adminSupportRouter.patch('/cases/:id/status', validate(statusChangeSchema), ctrl.adminSetStatus)
adminSupportRouter.patch('/cases/:id/priority', validate(prioritySchema), ctrl.adminSetPriority)
adminSupportRouter.post('/cases/:id/assign', validate(assignSchema), ctrl.adminAssign)
// Its own route rather than a status PATCH: an escalation carries a REQUIRED
// reason, and a status change that silently means "somebody senior should look"
// loses the one thing the senior person needs.
adminSupportRouter.post('/cases/:id/escalate', validate(escalateSchema), ctrl.adminEscalate)
