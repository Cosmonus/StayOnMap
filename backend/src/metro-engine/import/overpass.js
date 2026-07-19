// Overpass API client — endpoint rotation generalized from
// scripts/fetch-osm-pois.mjs (the main instance has 406'd from some
// environments; the mirrors are a real fallback path, not defensive padding).
import { OVERPASS_ENDPOINTS, REQUEST_TIMEOUT_MS } from '../constants.js'

// Runs one OverpassQL query, trying each endpoint in order (or only the
// caller-supplied override). Returns { json, endpoint, elapsedMs } so the
// raw-cache envelope can record exactly where the data came from.
export async function overpass(query, { endpoint = null } = {}) {
  const endpoints = endpoint ? [endpoint] : OVERPASS_ENDPOINTS
  let lastError = null
  for (const ep of endpoints) {
    const startedAt = Date.now()
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass asks for an identifiable agent so it can contact abusers
          // rather than silently blocking them.
          'User-Agent': 'StayOnMap/1.0 (metro data engine; https://www.stayonmap.com)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) { lastError = new Error(`${ep} → HTTP ${res.status}`); continue }
      return { json: await res.json(), endpoint: ep, elapsedMs: Date.now() - startedAt }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('all Overpass endpoints failed')
}
