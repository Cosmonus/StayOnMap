import 'dotenv/config'
import './config/env.js'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import { initSocket } from './lib/socket.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../../public')

import { errorMiddleware } from './middlewares/error.middleware.js'
import { defaultLimiter, strictLimiter, adminLimiter } from './middlewares/rateLimit.middleware.js'

import authRoutes        from './features/auth/auth.routes.js'
import propertyRoutes    from './features/properties/properties.routes.js'
import userRoutes        from './features/users/users.routes.js'
import uploadRoutes      from './features/uploads/uploads.routes.js'
import savedRoutes       from './features/saved/saved.routes.js'
import appointmentRoutes from './features/appointments/appointments.routes.js'
import notificationRoutes from './features/notifications/notifications.routes.js'
import chatRoutes         from './features/chat/chat.routes.js'
import leaseRoutes        from './features/leases/lease.routes.js'
import pushRoutes         from './features/push/push.routes.js'
import trustRoutes        from './features/trust/trust.routes.js'
import aiRoutes          from './features/ai/ai.routes.js'
import areaRoutes        from './features/areas/areas.routes.js'
import adminRoutes       from './features/admin/admin.routes.js'
import { adminReviewRouter }       from './features/reviews/reviews.routes.js'
import { adminReportRouter }       from './features/reports/reports.routes.js'
import { adminVerificationRouter } from './features/verification/verification.routes.js'

const app  = express()
const PORT = process.env.PORT ?? 4000

app.use(compression())
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(cors({
  origin: (origin, cb) => {
    const allowed = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const isDev = process.env.NODE_ENV !== 'production'
    if (!origin || origin === allowed || (isDev && /^http:\/\/localhost:\d+$/.test(origin))) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))
app.use(defaultLimiter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// User-facing routes
app.use('/api/v1/auth',          strictLimiter, authRoutes)
app.use('/api/v1/properties',    propertyRoutes)
app.use('/api/v1/users',         userRoutes)
app.use('/api/v1/uploads',       strictLimiter, uploadRoutes)
app.use('/api/v1/saved',         savedRoutes)
app.use('/api/v1/appointments',  appointmentRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/chat',          chatRoutes)
app.use('/api/v1/leases',        leaseRoutes)
app.use('/api/v1/push',          pushRoutes)
app.use('/api/v1/areas',         areaRoutes)

// Admin routes — high limit so moderation actions are never throttled
app.use('/api/v1/admin',               adminLimiter, adminRoutes)
app.use('/api/v1/admin/reviews',       adminLimiter, adminReviewRouter)
app.use('/api/v1/admin/reports',       adminLimiter, adminReportRouter)
app.use('/api/v1/admin/verifications', adminLimiter, adminVerificationRouter)
app.use('/api/v1/admin/trust-scores',  adminLimiter, trustRoutes)
app.use('/api/v1/admin/ai',            adminLimiter, aiRoutes)

// Serve React build — only when public/ exists (i.e. in production)
import { existsSync } from 'fs'
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

app.use(errorMiddleware)

const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)

  // Keep Render free tier warm — pings /health every 14 min to prevent spin-down
  if (process.env.SELF_URL) {
    setInterval(() => {
      fetch(`${process.env.SELF_URL}/health`).catch(() => {})
    }, 14 * 60 * 1000)
  }
})
