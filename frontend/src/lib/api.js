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

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const isAuthRequest = ['/auth/login', '/auth/register'].some(p => err.config?.url?.includes(p))
    if (err.response?.status === 401 && !isAuthRequest) {
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
