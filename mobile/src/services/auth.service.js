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

  // Phone verification — authenticated; you verify your own number. Both send
  // and consume a 6-digit SMS code (backend features/auth/phone.service.js).
  requestPhoneCode: (data) => api.post('/auth/phone/request', data),
  verifyPhoneCode: (data) => api.post('/auth/phone/verify', data),
  logout: (data) => api.post('/auth/logout', data),
  logoutAll: () => api.post('/auth/logout-all'),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (id) => api.delete(`/auth/sessions/${id}`),

  // Social login. Sign-in itself is a system-browser navigation (see
  // SocialLoginButtons) — these are the XHR halves of the flow.
  getOAuthProviders: () => api.get('/auth/oauth/providers'),
  completeOAuthSignup: (data) => api.post('/auth/oauth/complete', data),
  getLinkedAccounts: () => api.get('/auth/linked-accounts'),
  startLinkProvider: (provider) => api.post(`/auth/oauth/${provider}/link`, { platform: 'mobile' }),
  unlinkProvider: (provider) => api.delete(`/auth/oauth/${provider}`),
}
