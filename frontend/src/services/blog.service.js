import { api } from '@lib/api'

// Articles are served from files on the backend (see
// backend/src/features/blog/blog.service.js), so these are memory reads on the
// server side — cheap enough that the list page fetches the whole index rather
// than paginating. Revisit when there are enough posts for that to be untrue.
export const blogService = {
  list: (params) => api.get('/blog', { params }),
  getBySlug: (slug) => api.get(`/blog/${slug}`),
}
