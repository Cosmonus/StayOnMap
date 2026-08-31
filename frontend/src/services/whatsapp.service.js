import { api } from '@lib/api'

// The only user-facing WhatsApp endpoint the website calls: exchanging the
// single-use sign-in link an owner received on WhatsApp for a session. The
// conversation itself never touches the browser.
export const whatsappService = {
  exchangeLoginLink: (token) => api.post('/whatsapp/login-link/verify', { token }),
}
