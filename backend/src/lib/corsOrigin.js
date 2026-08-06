// Shared between Express's CORS middleware (index.js) and Socket.io's CORS
// config (socket.js) — they used to duplicate this check, and drifted: when
// the custom domain (stayonmap.com) went live, Express's PROD_ORIGINS list
// covered it but Socket.io's config only checked FRONTEND_URL (still pointing
// at a stale host subdomain), silently breaking chat/notifications for anyone
// on the real production domain. One shared function means this can't diverge
// again.
const PROD_ORIGINS = ['https://stayonmap.com', 'https://www.stayonmap.com']

export function corsOriginHandler(origin, cb) {
  const allowed = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const isDev = process.env.NODE_ENV !== 'production'
  if (!origin || origin === allowed || PROD_ORIGINS.includes(origin) || (isDev && /^http:\/\/localhost:\d+$/.test(origin))) {
    cb(null, true)
  } else {
    // Log the offending origin — a rejected request surfaces in the browser as
    // a bare "CORS error" with no server-side trace otherwise, making live
    // incidents undiagnosable after the fact.
    console.warn(JSON.stringify({ src: 'cors', event: 'origin_rejected', origin, allowed }))
    cb(Object.assign(new Error('Not allowed by CORS'), { statusCode: 403, code: 'CORS_FORBIDDEN' }))
  }
}
