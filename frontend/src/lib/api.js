// Axios instances — user API (custom JWT) + admin API (admin JWT)
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL

// ── User API — attaches user JWT from localStorage ────────────────
export const api = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('user_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// One refresh in flight at a time — a burst of 401s (page load with an
// expired token) must produce ONE rotation, not a race of many. Rotation is
// single-use server-side, so a second concurrent refresh would revoke the
// session as a replay.
let refreshing = null
function tryRefresh() {
  const refreshToken = localStorage.getItem('user_refresh_token')
  if (!refreshToken) return Promise.resolve(null)
  refreshing ??= axios.post(`${BASE}/auth/refresh`, { refreshToken })
    .then((r) => {
      const { token, refreshToken: next } = r.data.data
      localStorage.setItem('user_token', token)
      localStorage.setItem('user_refresh_token', next)
      return token
    })
    .catch(() => {
      localStorage.removeItem('user_refresh_token')
      return null
    })
    .finally(() => { refreshing = null })
  return refreshing
}

api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const isAuthRequest = ['/auth/login', '/auth/register', '/auth/refresh'].some(p => err.config?.url?.includes(p))
    if (err.response?.status === 401 && !isAuthRequest && !err.config?._retried) {
      // Expired access token? Try the refresh token once, then replay the
      // original request with the fresh JWT.
      const token = await tryRefresh()
      if (token) {
        return api({ ...err.config, _retried: true, headers: { ...err.config.headers, Authorization: `Bearer ${token}` } })
      }
      // User pages are public-browsable (home, listings) — don't hard-redirect
      // on an expired token like adminApi does. Just drop the stale token and
      // let AuthContext react naturally on its next render/check.
      localStorage.removeItem('user_token')
    }
    return Promise.reject(err.response?.data ?? err)
  }
)

// ── Admin API — attaches admin JWT from localStorage ─────────────
export const adminApi = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let redirectingToLogin = false
adminApi.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/admin/login')
    if (err.response?.status === 401 && !isLoginRequest && !redirectingToLogin) {
      redirectingToLogin = true
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err.response?.data ?? err)
  }
)
