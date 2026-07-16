import * as Sentry from '@sentry/react'

// Entirely inert until VITE_SENTRY_DSN is set — safe to leave unconfigured
// in any environment (dev, CI, or a prod deploy that hasn't added a DSN yet).
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'production',
    tracesSampleRate: 0.1,
  })
}
