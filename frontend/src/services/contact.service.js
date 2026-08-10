import { api } from '@lib/api'

// The public contact form. Unauthenticated by design — someone locked out of
// their account still needs to reach us, which is most of what a contact form
// is for. `api` rather than a bare fetch for the same reason as every other
// service: the interceptor unwraps res.data and normalises errors.
export const contactService = {
  send: (payload) => api.post('/contact', payload),
}
