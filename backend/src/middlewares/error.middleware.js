// Global Express error handler — must be registered last in index.js

const isProd = process.env.NODE_ENV === 'production'

export function errorMiddleware(err, _req, res, _next) {
  console.error(err)

  const status = err.statusCode || err.status || 500

  // Never leak internal error details to clients in production
  const message = status < 500
    ? err.message                        // 4xx: safe to show (validation, auth, not found)
    : isProd
      ? 'Internal server error'          // 5xx in prod: hide details
      : err.message                      // 5xx in dev: show for debugging

  res.status(status).json({
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    message,
    statusCode: status,
  })
}
