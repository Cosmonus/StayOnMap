import Redis from 'ioredis'

// Redis is optional — if REDIS_URL is not set the helpers are no-ops so dev works without it
let client = null

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  })
  client.on('error', (err) => console.error('[redis]', err.message))
}

export const redis = client

export async function cacheGet(key) {
  if (!redis) return null
  try {
    const val = await redis.get(key)
    return val ? JSON.parse(val) : null
  } catch { return null }
}

export async function cacheSet(key, value, ttlSeconds) {
  if (!redis) return
  try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds) } catch { /* fire-and-forget */ }
}

export async function cacheDel(key) {
  if (!redis) return
  try { await redis.del(key) } catch { /* fire-and-forget */ }
}
