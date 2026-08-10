// Global Express error handler — must be registered last in index.js
import { recordServerError } from '../lib/errorLog.js'

const isProd = process.env.NODE_ENV === 'production'

const DEFAULT_CODE = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
}

// Prisma errors that are really CLIENT errors, mapped once, centrally.
//
// `.claude/backend.md` and `.claude/database.md` both mandate catching P2025
// and converting it to a 404 in the service layer. The 2026-07-17 audit found
// that had happened in exactly one place (`saved.service.js`) out of ~46
// update/delete call sites, so every other "the row vanished between read and
// write" surfaced as a 500: a real bug for the user (a retryable 404 reported
// as a server fault), noise that buries genuine 5xx in the logs, and — once
// Sentry has a DSN — a permanent stream of false alerts.
//
// Doing it here rather than per-service is deliberate. A convention that must
// be remembered at 46 sites has already been forgotten at 45 of them; the
// middleware cannot be forgotten by a new call site. Service-layer catches
// remain correct and take precedence — they set `statusCode` themselves and
// never reach this map — so this is a floor, not a ceiling.
//
// Only codes whose meaning is unambiguously the caller's are mapped. Anything
// else stays a 500, because a connection failure or a schema mismatch is ours.
const PRISMA_STATUS = {
  P2025: 404, // required record not found (update/delete on a vanished row)
  P2002: 409, // unique constraint — the row already exists
  P2003: 400, // foreign key constraint — caller referenced something absent
}

const PRISMA_MESSAGE = {
  P2025: 'Not found',
  P2002: 'Already exists',
  P2003: 'Invalid reference',
}

// Multer's own errors, which are the CALLER's every time — a file too big, too
// many files, the wrong field name. They carry no `statusCode`, so until
// 2026-08-10 they defaulted to 500: the person got "Internal server error" for
// picking a photo off their camera roll, and `recordServerError` filed their
// mistake in the admin System Monitor's 5xx ring as a server fault. A triage
// list that fills up with users' oversized holiday photos is a triage list
// nobody reads.
//
// Mapped here rather than per-route for the same reason as the Prisma codes
// above: there are four upload routes and a fifth will not remember.
// `fileFilter` rejections already set their own statusCode and never reach this.
const MULTER_STATUS = {
  LIMIT_FILE_SIZE: 413,          // "Payload Too Large" — the honest answer
  LIMIT_FILE_COUNT: 400,
  LIMIT_UNEXPECTED_FILE: 400,
  LIMIT_PART_COUNT: 400,
  LIMIT_FIELD_KEY: 400,
  LIMIT_FIELD_VALUE: 400,
  LIMIT_FIELD_COUNT: 400,
}

// Multer's raw text is written for a developer ("File too large"). These say
// what to do about it, since the person reading it is choosing another file.
const MULTER_MESSAGE = {
  LIMIT_FILE_SIZE: 'That file is too large. The limit is 5MB per file.',
  LIMIT_FILE_COUNT: 'Too many files at once.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
}

export function errorMiddleware(err, req, res, _next) {
  console.error(err)

  let status = err.statusCode || err.status || 500

  // Same precedence rule as the Prisma map below: an upstream decision wins.
  if (!err.statusCode && !err.status && err.name === 'MulterError') {
    status = MULTER_STATUS[err.code] ?? 400
    err = Object.assign(new Error(MULTER_MESSAGE[err.code] ?? 'That upload could not be accepted.'), {
      code: err.code,
      statusCode: status,
    })
  }

  // Only reinterpret when nothing upstream already decided. An explicit
  // statusCode from a service is a considered choice and outranks the map.
  if (!err.statusCode && !err.status && PRISMA_STATUS[err.code]) {
    status = PRISMA_STATUS[err.code]
    err = Object.assign(new Error(PRISMA_MESSAGE[err.code]), {
      code: err.code,
      statusCode: status,
    })
  }

  // Never leak internal error details to clients in production.
  //
  // `err.expose` (the http-errors convention) opts a specific 5xx out of
  // sanitisation. Set it ONLY on messages we authored for the user — never on
  // anything derived from a caught exception, whose text can carry a stack,
  // file path, or DB detail. It exists because some 5xx are expected and
  // actionable: a 503 meaning "sign-in codes are unavailable, use your
  // password" is useless to the user as "Internal server error", and 503 is
  // the semantically correct status (the failure is ours, not the caller's),
  // so downgrading it to a 4xx just to get the text through would be a lie.
  const message = status < 500
    ? err.message                        // 4xx: safe to show (validation, auth, not found)
    : isProd
      ? (err.expose ? err.message : 'Internal server error')
      : err.message                      // 5xx in dev: show for debugging

  // Same rule for the machine-readable code: an uncaught Prisma error carries
  // err.code = 'P2025', which discloses the ORM to clients. Only `expose`
  // (or dev, or a 4xx) lets a specific code through on a 5xx.
  //
  // The fallback is status-derived, not a flat 'INTERNAL_ERROR': a service
  // throwing `Object.assign(new Error(msg), { statusCode: 409 })` sets no
  // `code`, and labelling that conflict INTERNAL_ERROR tells the client we
  // broke when in fact they did something we refuse. Clients branch on this.
  const code = status < 500 || !isProd || err.expose
    ? (err.code || DEFAULT_CODE[status] || (status < 500 ? 'REQUEST_ERROR' : 'INTERNAL_ERROR'))
    : 'INTERNAL_ERROR'

  // Recorded AFTER the status is finalised, so a Prisma P2025 that is really a
  // 404 does not show up as a server fault — and only 5xx, because a 401 or a
  // 404 is the caller's business, not a symptom. The UNSANITISED message is
  // kept: this is an admin-only triage list, and 'Internal server error' fifty
  // times over is exactly the readout that made journalctl necessary.
  if (status >= 500) {
    recordServerError({
      status,
      code: err.code,
      message: err.message,
      path: req?.originalUrl ?? req?.url,
      method: req?.method,
    })
  }

  res.status(status).json({
    success: false,
    error: code,
    message,
    statusCode: status,
  })
}
