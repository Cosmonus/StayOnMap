import './lib/netTuning.js'
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
import { corsOriginHandler } from './lib/corsOrigin.js'
import { initSentry, setupExpressErrorHandler } from './lib/sentry.js'

// Must run before the app is built — instruments Express/http/Prisma automatically
initSentry()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../../public')

// Node terminates the process on any unhandled rejection by default (since v15) —
// without this, one stray promise anywhere (a missed await, a third-party lib
// edge case) takes the whole server down instead of just failing that one
// operation. uncaughtException is intentionally left to crash — Node's own
// guidance is that process state may be corrupted past that point, and systemd
// (Restart=always in stayonmap-api.service) restarts a crashed process automatically.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

import { errorMiddleware } from './middlewares/error.middleware.js'
import { defaultLimiter, uploadLimiter, adminLimiter } from './middlewares/rateLimit.middleware.js'

import authRoutes        from './features/auth/auth.routes.js'
import propertyRoutes    from './features/properties/properties.routes.js'
import hostRoutes from './features/host/host.routes.js'
import userRoutes        from './features/users/users.routes.js'
import uploadRoutes      from './features/uploads/uploads.routes.js'
import savedRoutes       from './features/saved/saved.routes.js'
import appointmentRoutes from './features/appointments/appointments.routes.js'
import notificationRoutes from './features/notifications/notifications.routes.js'
import pointsRoutes       from './features/points/points.routes.js'
import chatRoutes         from './features/chat/chat.routes.js'
import leaseRoutes        from './features/leases/lease.routes.js'
import pushRoutes         from './features/push/push.routes.js'
import trustRoutes        from './features/trust/trust.routes.js'
import placeRoutes        from './features/places/places.routes.js'
import spatialRoutes      from './features/spatial/spatial.routes.js'
import { startRefresher } from './features/spatial/refresher.js'
import aiRoutes          from './features/ai/ai.routes.js'
import areaRoutes        from './features/areas/areas.routes.js'
import metroRoutes       from './features/metro/metro.routes.js'
import itCorridorRoutes  from './features/itCorridors/itCorridors.routes.js'
import adminRoutes       from './features/admin/admin.routes.js'
import { adminReportRouter }       from './features/reports/reports.routes.js'
import { adminVerificationRouter } from './features/verification/verification.routes.js'

const app  = express()
const PORT = process.env.PORT ?? 4000

// nginx terminates TLS and reverse-proxies to the API on localhost — without
// this, req.ip is the proxy's address for every request, so all users share
// one rate-limit bucket (the 20-req/15-min auth limiter becomes server-wide,
// failing real signups/logins under normal traffic). Trust exactly one hop.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

app.use(compression())
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.use(cors({ origin: corsOriginHandler, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(defaultLimiter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// User-facing routes
app.use('/api/v1/auth',          authRoutes)
app.use('/api/v1/properties',    propertyRoutes)
app.use('/api/v1/host',          hostRoutes)
app.use('/api/v1/users',         userRoutes)
app.use('/api/v1/uploads',       uploadLimiter, uploadRoutes)
app.use('/api/v1/saved',         savedRoutes)
app.use('/api/v1/appointments',  appointmentRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/points',        pointsRoutes)
app.use('/api/v1/chat',          chatRoutes)
app.use('/api/v1/leases',        leaseRoutes)
app.use('/api/v1/push',          pushRoutes)
app.use('/api/v1/areas',         areaRoutes)
app.use('/api/v1/places',        placeRoutes)
app.use('/api/v1/spatial',       spatialRoutes)
app.use('/api/v1/metro',         metroRoutes)
app.use('/api/v1/it-corridors',  itCorridorRoutes)

// Admin routes — high limit so moderation actions are never throttled
app.use('/api/v1/admin',               adminLimiter, adminRoutes)
app.use('/api/v1/admin/reports',       adminLimiter, adminReportRouter)
app.use('/api/v1/admin/verifications', adminLimiter, adminVerificationRouter)
app.use('/api/v1/admin/trust-scores',  adminLimiter, trustRoutes)
app.use('/api/v1/admin/ai',            adminLimiter, aiRoutes)

// Serve React build — only when public/ exists (i.e. in production)
import { existsSync } from 'fs'
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
  // Express 5's path-to-regexp requires a named wildcard — bare '*' throws
  // "Missing parameter name" at route-registration time now, not a lint nit.
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

setupExpressErrorHandler(app)
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

  // Refresh stale spatial intelligence cells in the background. Prefers a
  // durable pg-boss schedule so a deploy mid-tick doesn't silently drop the
  // work; falls back to an in-memory interval when the queue can't start.
  // Either way only one instance runs a given tick.
  startRefresher()
    .then((path) => console.log(`Spatial refresher started (${path})`))
    .catch(() => {})
})
