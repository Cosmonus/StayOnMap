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

// Support evidence: ONE endpoint, EVERY file type, and deliberately no
// fileFilter at all.
//
// Every other uploader here is an allowlist and should stay one. This is the
// exception because narrowing the types narrows what somebody can PROVE — a
// fabricated agreement is a .docx, a threatening voice note is an .m4a, a
// WhatsApp export is a .txt in a .zip, and refusing those is refusing the
// complaint. The safety lives in how the file is STORED rather than in whether
// it is accepted: evidence.service.js serves inline only what the bytes prove
// is safe and makes everything else download. Read the header there before
// changing either half.
//
// 25MB rather than 5: a phone video and a scanned agreement are both routinely
// larger than a photo, and the cap exists to bound abuse, not to curate.
const uploadEvidence = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
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
