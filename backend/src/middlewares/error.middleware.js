// Global Express error handler — must be registered last in index.js

const isProd = process.env.NODE_ENV === 'production'

const DEFAULT_CODE = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
}

export function errorMiddleware(err, _req, res, _next) {
  console.error(err)

  const status = err.statusCode || err.status || 500

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

  res.status(status).json({
    success: false,
    error: code,
    message,
    statusCode: status,
  })
}
