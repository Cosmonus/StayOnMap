// Auth API calls — wraps Supabase Auth
// Note: most auth is handled via Supabase client directly (AuthContext)
// These are for backend-side profile sync

import { api } from '@lib/api'

export const authService = {
  syncProfile: (data) => api.post('/auth/sync', data),
  getMe: () => api.get('/auth/me'),
  upgradeRole: () => api.patch('/auth/role', { role: 'OWNER' }),
}
