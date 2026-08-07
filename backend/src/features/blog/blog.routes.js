import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middlewares/validate.middleware.js'
import { ok, notFound } from '../../utils/response.js'
import { listPosts, getPost, CLUSTERS } from './blog.service.js'

const router = Router()

// Public and unauthenticated. Reads come from memory — no DB, no cache header
// games needed beyond letting the CDN-less nginx and the browser hold it
// briefly. A deploy restarts the process, which is what invalidates it.
const listQuerySchema = z.object({
  cluster: z.enum(Object.keys(CLUSTERS)).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

router.get('/', validate(listQuerySchema, 'query'), (req, res, next) => {
  try {
    const posts = listPosts(req.query)
    res.set('Cache-Control', 'public, max-age=300')
    ok(res, { posts, clusters: CLUSTERS })
  } catch (err) { next(err) }
})

router.get('/:slug', (req, res, next) => {
  try {
    const post = getPost(req.params.slug)
    if (!post) return notFound(res)
    res.set('Cache-Control', 'public, max-age=300')
    ok(res, post)
  } catch (err) { next(err) }
})

export default router
