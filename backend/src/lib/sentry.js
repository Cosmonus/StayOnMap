import * as Sentry from '@sentry/node'
import { env } from '../config/env.js'

// Entirely inert until SENTRY_DSN is set — safe to leave unconfigured in any
// environment (dev, CI, or a prod deploy that hasn't added a DSN yet).
export const sentryEnabled = !!env.sentryDsn

export function initSentry() {
  if (!sentryEnabled) return
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.nodeEnv === 'production' ? 0.1 : 0,
  })
}

export function setupExpressErrorHandler(app) {
  if (!sentryEnabled) return
  Sentry.setupExpressErrorHandler(app)
}
