import { api } from '@lib/api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  upgradeRole: () => api.patch('/auth/role', { role: 'OWNER' }),
  upgradeBusiness: () => api.patch('/auth/business'),
  requestPasswordReset: (data) => api.post('/auth/forgot-password', data),
  sendEmailVerification: () => api.post('/auth/send-verification'),
  requestLoginOtp: (data) => api.post('/auth/otp/request', data),
  verifyLoginOtp: (data) => api.post('/auth/otp/verify', data),
  logout: (data) => api.post('/auth/logout', data),
}
