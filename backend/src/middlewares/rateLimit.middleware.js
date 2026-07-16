import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../lib/redis.js'

const isDev = process.env.NODE_ENV !== 'production'

// In development all requests share the same IP (localhost) — skip limiting to avoid false 429s
const noop = (_req, _res, next) => next()

// A dedicated connection, not the shared fail-fast cache client: RedisStore's
// constructor loads Lua scripts (loadGetScript/loadIncrementScript)
// synchronously at import time, before the main client's lazy connection is
// ready — with enableOfflineQueue: false that throws "Stream isn't writeable"
// on every boot (same root cause as the Socket.io adapter crash — see
// lib/socket.js and docs/redis-and-scaling.md).
const rateLimitRedis = redis ? redis.duplicate({ enableOfflineQueue: true, lazyConnect: false }) : null
if (rateLimitRedis) rateLimitRedis.on('error', (err) => console.error('[redis:ratelimit]', err.message))

// Without this, express-rate-limit's default MemoryStore counts hits
// per-process — correct on a single instance, but once the backend runs as
// multiple horizontally-scaled instances (see roadmap.md), each instance
// tracks its own counter, silently multiplying the effective limit by the
// instance count. Redis-backed when available; falls back to the default
// in-memory store (same as before) if REDIS_URL isn't set, so this is a
// no-op change for local dev.
function redisStore(prefix) {
  if (!rateLimitRedis) return undefined
  return new RedisStore({
    prefix,
    sendCommand: (...args) => rateLimitRedis.call(...args),
  })
}

function makeLimiter({ prefix, windowMs, max, message }) {
  if (isDev) return noop
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(message && { message }),
    store: redisStore(prefix),
  })
}

// Map browsing is request-heavy by design: every pan/zoom fires /pins (+ the
// homepage list), and the header polls unread counts every 30-60s — a single
// active session legitimately makes several hundred requests per window.
export const defaultLimiter = makeLimiter({
  prefix: 'rl:default:',
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { success: false, message: 'Too many requests', statusCode: 429 },
})

export const strictLimiter = makeLimiter({
  prefix: 'rl:strict:',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts, try again later', statusCode: 429 },
})

// Own bucket, separate from auth: one listing uploads up to 10 images, and a
// shared 20-req bucket with /auth locked users out of both mid-onboarding
export const uploadLimiter = makeLimiter({
  prefix: 'rl:upload:',
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many uploads, try again later', statusCode: 429 },
})

// Scoped to sending messages only (not the whole /chat router) — ~8 msgs/min
// average is generous for a real conversation but blocks spam/bot floods
export const chatLimiter = makeLimiter({
  prefix: 'rl:chat:',
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Too many messages, slow down', statusCode: 429 },
})

// Admin users are trusted operators — generous limit so moderation actions never get throttled
export const adminLimiter = makeLimiter({
  prefix: 'rl:admin:',
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many admin requests', statusCode: 429 },
})
