import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('user_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Unwraps the backend envelope on success; rejects with the backend's JSON
// error body on failure (or the raw error if there was no response at all).
api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data ?? err)
)
