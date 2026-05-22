import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './uploads.controller.js'

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    // Whitelist specific types — rejects svg, gif, tiff, and spoofed types
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPEG, PNG and WebP images are allowed'), { statusCode: 400 }))
    }
    cb(null, true)
  },
})

const router = Router()

router.post('/property-image', authMiddleware, upload.single('image'), controller.uploadPropertyImage)
router.post('/avatar',         authMiddleware, upload.single('image'), controller.uploadAvatar)

export default router
