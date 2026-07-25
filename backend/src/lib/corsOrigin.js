// Shared between Express's CORS middleware (index.js) and Socket.io's CORS
// config (socket.js) — they used to duplicate this check, and drifted: when
// the custom domain (stayonmap.com) went live, Express's PROD_ORIGINS list
// covered it but Socket.io's config only checked FRONTEND_URL (still the old
// Railway subdomain), silently breaking chat/notifications for anyone on the
// real production domain. One shared function means this can't diverge again.
const PROD_ORIGINS = ['https://stayonmap.com', 'https://www.stayonmap.com']

// DEV ONLY — loopback plus the RFC1918 private ranges.
//
// `localhost` alone is not enough for mobile development, and the way it fails
// is the same one this file already exists to prevent: REST keeps working while
// the socket dies silently. React Native sends an `Origin` header equal to the
// API's own URL on the engine.io handshake, and the emulator reaches the host
// as **10.0.2.2**, never `localhost` — so chat, typing, online status and live
// notifications were CORS-rejected on every emulator run, retrying once a
// second (socket.js sets reconnectionAttempts: 10). A physical device over the
// LAN (192.168.x.x) hit exactly the same wall.
//
// Private ranges only, and only when NODE_ENV !== 'production' — a public
// deployment still accepts nothing but FRONTEND_URL and PROD_ORIGINS.
const DEV_ORIGIN = new RegExp(
  '^https?://(' +
    'localhost' +
    '|127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' +
    '|\\[::1\\]' +
    '|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' +          // incl. 10.0.2.2 (Android emulator host)
    '|192\\.168\\.\\d{1,3}\\.\\d{1,3}' +               // LAN, physical device
    '|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}' +
  ')(:\\d+)?$',
)

export function corsOriginHandler(origin, cb) {
  const allowed = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const isDev = process.env.NODE_ENV !== 'production'
  if (!origin || origin === allowed || PROD_ORIGINS.includes(origin) || (isDev && DEV_ORIGIN.test(origin))) {
    cb(null, true)
  } else {
    // Log the offending origin — a rejected request surfaces in the browser as
    // a bare "CORS error" with no server-side trace otherwise, making live
    // incidents undiagnosable after the fact.
    console.warn(JSON.stringify({ src: 'cors', event: 'origin_rejected', origin, allowed }))
    cb(Object.assign(new Error('Not allowed by CORS'), { statusCode: 403, code: 'CORS_FORBIDDEN' }))
  }
}
