// Axios instances — user API (Supabase JWT) + admin API (admin JWT)
import axios from 'axios'
import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_BASE_URL

// ── User API — attaches Supabase session token ──────────────────
export const api = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data ?? err)
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
