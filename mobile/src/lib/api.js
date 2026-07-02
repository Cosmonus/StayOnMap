import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 10000,
})

// Re-reads the session on every request (Supabase auto-refreshes it in the
// background) rather than caching a token — mirrors frontend/src/lib/api.js.
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Unwraps the backend envelope on success; rejects with the backend's JSON
// error body on failure (or the raw error if there was no response at all).
api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data ?? err)
)
