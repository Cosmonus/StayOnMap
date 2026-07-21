import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// eslint-disable-next-line import/no-named-as-default-member -- axios.create is the documented usage; axios's dual CJS/ESM export shape is a known false positive for this rule
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('user_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// One refresh in flight at a time — refresh tokens are single-use server-side
// (rotation), so a burst of 401s racing multiple refreshes would trip the
// replay detector and revoke the session.
let refreshing = null
function tryRefresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await AsyncStorage.getItem('user_refresh_token')
      if (!refreshToken) return null
      try {
        const r = await axios.post(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/refresh`, { refreshToken })
        const { token, refreshToken: next } = r.data.data
        await AsyncStorage.setItem('user_token', token)
        await AsyncStorage.setItem('user_refresh_token', next)
        return token
      } catch (_err) {
        await AsyncStorage.removeItem('user_refresh_token')
        return null
      }
    })().finally(() => { refreshing = null })
  }
  return refreshing
}

// Unwraps the backend envelope on success; rejects with the backend's JSON
// error body on failure (or the raw error if there was no response at all).
// A 401 with a stored refresh token gets ONE silent refresh-and-retry first.
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const isAuthRequest = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/otp'].some(
      (p) => err.config?.url?.includes(p)
    )
    if (err.response?.status === 401 && !isAuthRequest && !err.config?._retried) {
      const token = await tryRefresh()
      if (token) {
        return api({
          ...err.config,
          _retried: true,
          headers: { ...err.config.headers, Authorization: `Bearer ${token}` },
        })
      }
    }
    return Promise.reject(err.response?.data ?? err)
  }
)
