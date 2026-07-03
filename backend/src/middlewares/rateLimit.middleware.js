import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../lib/redis.js'

const isDev = process.env.NODE_ENV !== 'production'

// In development all requests share the same IP (localhost) — skip limiting to avoid false 429s
const noop = (_req, _res, next) => next()

// Without this, express-rate-limit's default MemoryStore counts hits
// per-process — correct on a single instance, but once the backend runs as
// multiple horizontally-scaled instances (see roadmap.md), each instance
// tracks its own counter, silently multiplying the effective limit by the
// instance count. Redis-backed when available; falls back to the default
// in-memory store (same as before) if REDIS_URL isn't set, so this is a
// no-op change for local dev.
function redisStore(prefix) {
  if (!redis) return undefined
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redis.call(...args),
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

export const defaultLimiter = makeLimiter({
  prefix: 'rl:default:',
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests', statusCode: 429 },
})

export const strictLimiter = makeLimiter({
  prefix: 'rl:strict:',
  windowMs: 15 * 60 * 1000,
  max: 20,
})

// Admin users are trusted operators — generous limit so moderation actions never get throttled
export const adminLimiter = makeLimiter({
  prefix: 'rl:admin:',
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many admin requests', statusCode: 429 },
})
