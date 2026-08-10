import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './uploads.controller.js'

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']

// Documents get their own multer instance: a different allowlist and a smaller
// cap. An agreement draft is a few hundred KB; 5MB of "PDF" is a red flag.
const DOC_MIMETYPES = ['application/pdf']

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!DOC_MIMETYPES.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only PDF documents are allowed'), { statusCode: 400 }))
    }
    cb(null, true)
  },
})

// Support evidence is ONE endpoint taking either kind, unlike chat's split.
// What somebody attaches to a support case is "the proof", and they should not
// have to know whether ours is an image route or a document route: the fake
// listing is a screenshot, the disputed agreement is a PDF, and it is the same
// button in the same sentence. The service still branches on the real type.
const uploadEvidence = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (![...ALLOWED_MIMETYPES, ...DOC_MIMETYPES].includes(file.mimetype)) {
      return cb(Object.assign(new Error('Attach a JPEG, PNG, WebP image or a PDF'), { statusCode: 400 }))
    }
    cb(null, true)
  },
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    // Cheap early reject on the DECLARED type only — a spoofed declaration
    // passes here; uploads.service.js sniffs the actual bytes before storing.
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPEG, PNG and WebP images are allowed'), { statusCode: 400 }))
    }
    cb(null, true)
  },
})

const router = Router()

router.post('/property-image', authMiddleware, upload.single('image'), controller.uploadPropertyImage)
router.post('/avatar',         authMiddleware, upload.single('image'), controller.uploadAvatar)
router.post('/chat-image',     authMiddleware, upload.single('image'), controller.uploadChatImage)
router.post('/chat-file',      authMiddleware, uploadDoc.single('file'), controller.uploadChatFile)
router.post('/support-file',   authMiddleware, uploadEvidence.single('file'), controller.uploadSupportFile)

export default router
