import rateLimit from 'express-rate-limit'

const isDev = process.env.NODE_ENV !== 'production'

// In development all requests share the same IP (localhost) — skip limiting to avoid false 429s
const noop = (_req, _res, next) => next()

export const defaultLimiter = isDev ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests', statusCode: 429 },
})

export const strictLimiter = isDev ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

// Admin users are trusted operators — generous limit so moderation actions never get throttled
export const adminLimiter = isDev ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin requests', statusCode: 429 },
})
