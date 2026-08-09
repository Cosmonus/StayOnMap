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

  // Signing in by SMS. A separate pair from /auth/phone/request+verify, which
  // are AUTHENTICATED — those prove a number you already hold; these mint a
  // session. Only a number that has already been verified can receive one.
  requestPhoneLoginOtp: (data) => api.post('/auth/phone/login/request', data),
  verifyPhoneLoginOtp: (data) => api.post('/auth/phone/login/verify', data),

  // Phone verification — authenticated; you verify your own number. Both send
  // and consume a 6-digit SMS code (see backend features/auth/phone.service.js).
  requestPhoneCode: (data) => api.post('/auth/phone/request', data),
  verifyPhoneCode: (data) => api.post('/auth/phone/verify', data),

  // Sessions / devices
  logout: (data) => api.post('/auth/logout', data),
  logoutAll: () => api.post('/auth/logout-all'),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (id) => api.delete(`/auth/sessions/${id}`),

  // What this deployment offers — { sms }. SMS costs money per message, so a
  // deployment without a provider draws no SMS button at all.
  getSignInMethods: () => api.get('/auth/methods'),

  // Social login — GET /auth/oauth/:provider is a plain browser navigation,
  // not an XHR (the provider redirect chain can't run through axios).
  getOAuthProviders: () => api.get('/auth/oauth/providers'),
  completeOAuthSignup: (data) => api.post('/auth/oauth/complete', data),
  getLinkedAccounts: () => api.get('/auth/linked-accounts'),
  startLinkProvider: (provider) => api.post(`/auth/oauth/${provider}/link`),
  unlinkProvider: (provider) => api.delete(`/auth/oauth/${provider}`),
}
