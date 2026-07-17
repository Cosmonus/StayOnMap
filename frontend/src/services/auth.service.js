// Auth API calls — custom JWT (see @features/auth/context/AuthContext for
// where the token/user state lives on the frontend)

import { api } from '@lib/api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  upgradeRole: () => api.patch('/auth/role', { role: 'OWNER' }),
  upgradeBusiness: () => api.patch('/auth/business'),
  requestPasswordReset: (data) => api.post('/auth/forgot-password', data),
  confirmPasswordReset: (data) => api.post('/auth/reset-password', data),
  sendEmailVerification: () => api.post('/auth/send-verification'),
  confirmEmailVerification: (data) => api.post('/auth/verify-email', data),
  requestLoginOtp: (data) => api.post('/auth/otp/request', data),
  verifyLoginOtp: (data) => api.post('/auth/otp/verify', data),
}
